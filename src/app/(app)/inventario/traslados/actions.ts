"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoTraslado } from "@/lib/correlativos";
import {
  distribucionZonas,
  MENSAJE_ERROR_ZONA,
  validarMovimientoEntreZonas,
} from "@/lib/saldosZona";

export type EstadoFormulario = { error?: string; ok?: boolean };

// Traslado entre almacenes: una SALIDA en el origen + una ENTRADA en el
// destino, con la misma referencia, dentro de una sola transacción. Si el
// origen no tiene stock suficiente, ninguna de las dos se aplica.
export async function crearTraslado(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const itemCompuesto = String(formData.get("item") ?? ""); // "PRESENTACION:id" | "INSUMO:id"
  const almacenOrigenId = String(formData.get("almacenOrigenId") ?? "");
  const almacenDestinoId = String(formData.get("almacenDestinoId") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  const [tipoItem, itemId] = itemCompuesto.split(":");
  if ((tipoItem !== "PRESENTACION" && tipoItem !== "INSUMO") || !itemId) {
    return { error: "Seleccione el ítem a trasladar." };
  }
  if (!almacenOrigenId || !almacenDestinoId) {
    return { error: "Seleccione el almacén de origen y el de destino." };
  }
  if (almacenOrigenId === almacenDestinoId) {
    return { error: "El almacén de origen y el de destino deben ser distintos." };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un número mayor a 0." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const [itemValido, almacenesValidos] = await Promise.all([
        tipoItem === "PRESENTACION"
          ? tx.presentacion.count({ where: { id: itemId, empresaId: auth.usuario.empresaId } })
          : tx.insumo.count({ where: { id: itemId, empresaId: auth.usuario.empresaId } }),
        tx.almacen.count({ where: { id: { in: [almacenOrigenId, almacenDestinoId] }, empresaId: auth.usuario.empresaId, activo: true } }),
      ]);
      if (!itemValido || almacenesValidos !== 2) throw new Error("El ítem o los almacenes no pertenecen a la empresa activa.");
      const referencia = await siguienteCodigoTraslado(tx, auth.usuario.empresaId);

      const salida = await registrarMovimiento(tx, {
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? itemId : undefined,
        insumoId: tipoItem === "INSUMO" ? itemId : undefined,
        tipoMovimiento: "SALIDA",
        origen: "TRASLADO",
        cantidad,
        referencia,
        motivo: motivo || undefined,
        almacenId: almacenOrigenId,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        empresaIdEsperada: auth.usuario.empresaId,
      });
      if (!salida.ok) throw new Error(salida.error);

      const entrada = await registrarMovimiento(tx, {
        tipoItem,
        presentacionId: tipoItem === "PRESENTACION" ? itemId : undefined,
        insumoId: tipoItem === "INSUMO" ? itemId : undefined,
        tipoMovimiento: "ENTRADA",
        origen: "TRASLADO",
        cantidad,
        referencia,
        motivo: motivo || undefined,
        almacenId: almacenDestinoId,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        empresaIdEsperada: auth.usuario.empresaId,
      });
      if (!entrada.ok) throw new Error(entrada.error);
    });
  } catch (e) {
    if (e instanceof Error) return { error: e.message };
    throw e;
  }

  revalidatePath("/inventario/traslados");
  revalidatePath("/inventario/kardex");
  return { ok: true };
}

// Reubicación entre zonas de un mismo almacén (WM-EWM reducido): a
// diferencia del traslado de arriba (que mueve cantidad de stock entre
// SaldoAlmacen de dos almacenes distintos), Presentacion/Insumo solo guardan
// UNA ubicación estructurada (zonaAlmacenId) — no hay cantidad partida entre
// zonas. Reubicar es entonces actualizar ese puntero, no un movimiento de
// kardex. Se valida que la zona destino pertenezca al mismo almacén que la
// zona actual, para no confundir esto con un traslado real entre almacenes
// (que sigue siendo el flujo de arriba).
export async function reubicarZona(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const itemCompuesto = String(formData.get("item") ?? "");
  const zonaDestinoId = String(formData.get("zonaDestinoId") ?? "");
  const [tipoItem, itemId] = itemCompuesto.split(":");

  if ((tipoItem !== "PRESENTACION" && tipoItem !== "INSUMO") || !itemId) {
    return { error: "Seleccione el ítem a reubicar." };
  }
  if (!zonaDestinoId) return { error: "Seleccione la zona destino." };

  const zonaDestino = await prisma.zonaAlmacen.findFirst({ where: { id: zonaDestinoId, almacen: { empresaId: auth.usuario.empresaId } } });
  if (!zonaDestino) return { error: "La zona destino no existe." };

  if (tipoItem === "PRESENTACION") {
    const item = await prisma.presentacion.findFirst({ where: { id: itemId, empresaId: auth.usuario.empresaId } });
    if (!item) return { error: "La presentación no existe." };
    if (item.zonaAlmacenId === zonaDestinoId) return { error: "Ya está en esa zona." };
    if (item.zonaAlmacenId) {
      const zonaActual = await prisma.zonaAlmacen.findUnique({ where: { id: item.zonaAlmacenId } });
      if (zonaActual && zonaActual.almacenId !== zonaDestino.almacenId) {
        return {
          error:
            "La zona destino pertenece a otro almacén — para eso use el traslado entre almacenes de arriba, no la reubicación de zona.",
        };
      }
    }
    await prisma.presentacion.update({ where: { id: itemId }, data: { zonaAlmacenId: zonaDestinoId } });
  } else {
    const item = await prisma.insumo.findFirst({ where: { id: itemId, empresaId: auth.usuario.empresaId } });
    if (!item) return { error: "El insumo no existe." };
    if (item.zonaAlmacenId === zonaDestinoId) return { error: "Ya está en esa zona." };
    if (item.zonaAlmacenId) {
      const zonaActual = await prisma.zonaAlmacen.findUnique({ where: { id: item.zonaAlmacenId } });
      if (zonaActual && zonaActual.almacenId !== zonaDestino.almacenId) {
        return {
          error:
            "La zona destino pertenece a otro almacén — para eso use el traslado entre almacenes de arriba, no la reubicación de zona.",
        };
      }
    }
    await prisma.insumo.update({ where: { id: itemId }, data: { zonaAlmacenId: zonaDestinoId } });
  }

  revalidatePath("/inventario/traslados");
  return { ok: true };
}

// Reparto de stock entre zonas del MISMO almacén. A diferencia de un traslado,
// esto no toca el kardex ni el saldo del almacén: la mercadería no se mueve de
// almacén, solo se dice en qué zona está. Por eso no genera movimiento —
// inventar entradas y salidas para un cambio de estante ensuciaría la historia
// de costos con ruido que no es un movimiento real.
//
// El origen puede ser una zona o el stock que todavía no se asignó a ninguna.
export async function moverEntreZonas(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." };
  }

  const empresaId = auth.usuario.empresaId;
  const almacenId = String(formData.get("almacenId") ?? "");
  const [tipoItem, itemId] = String(formData.get("item") ?? "").split(":");
  const zonaOrigenId = String(formData.get("zonaOrigenId") ?? "") || null;
  const zonaDestinoId = String(formData.get("zonaDestinoId") ?? "");
  const cantidad = Number(formData.get("cantidad") ?? 0);

  if (tipoItem !== "PRESENTACION" && tipoItem !== "INSUMO") return { error: "Seleccione el ítem." };
  if (!itemId) return { error: "Seleccione el ítem." };
  if (!almacenId) return { error: "Seleccione el almacén." };
  if (!zonaDestinoId) return { error: "Seleccione la zona destino." };

  const esPresentacion = tipoItem === "PRESENTACION";

  try {
    await prisma.$transaction(async (tx) => {
      // Todo se relee acotado a la compañía activa: almacén, zonas e ítem
      // llegan del formulario.
      const almacen = await tx.almacen.findFirst({
        where: { id: almacenId, empresaId },
        select: { id: true },
      });
      if (!almacen) throw new Error("El almacén no pertenece a la compañía activa.");

      const zonas = await tx.zonaAlmacen.findMany({
        where: { almacenId, activo: true },
        select: { id: true },
      });
      const idsZona = new Set(zonas.map((z) => z.id));
      if (!idsZona.has(zonaDestinoId)) throw new Error("La zona destino no pertenece a ese almacén.");
      if (zonaOrigenId && !idsZona.has(zonaOrigenId)) {
        throw new Error("La zona de origen no pertenece a ese almacén.");
      }

      const item = esPresentacion
        ? await tx.presentacion.findFirst({ where: { id: itemId, empresaId }, select: { id: true } })
        : await tx.insumo.findFirst({ where: { id: itemId, empresaId }, select: { id: true } });
      if (!item) throw new Error("El ítem no pertenece a la compañía activa.");

      const [saldoAlmacen, saldos] = await Promise.all([
        tx.saldoAlmacen.findFirst({
          where: {
            almacenId,
            tipoItem,
            presentacionId: esPresentacion ? itemId : null,
            insumoId: esPresentacion ? null : itemId,
          },
        }),
        tx.saldoZona.findMany({ where: { itemId, zona: { almacenId } } }),
      ]);

      const distribucion = distribucionZonas(
        saldoAlmacen?.cantidad.toNumber() ?? 0,
        saldos.map((s) => ({ zonaAlmacenId: s.zonaAlmacenId, cantidad: s.cantidad.toNumber() }))
      );
      const error = validarMovimientoEntreZonas(
        { zonaOrigenId, zonaDestinoId, cantidad },
        distribucion
      );
      if (error) throw new Error(MENSAJE_ERROR_ZONA[error]);

      if (zonaOrigenId) {
        const saldoOrigen = saldos.find((s) => s.zonaAlmacenId === zonaOrigenId);
        if (!saldoOrigen) throw new Error(MENSAJE_ERROR_ZONA.SIN_SALDO_EN_ORIGEN);
        // Reclamo optimista sobre la cantidad leída: si otra sesión movió la
        // misma zona entremedio, esto no aplica y el usuario reintenta.
        const reclamo = await tx.saldoZona.updateMany({
          where: { id: saldoOrigen.id, cantidad: saldoOrigen.cantidad },
          data: { cantidad: { decrement: cantidad } },
        });
        if (reclamo.count !== 1) {
          throw new Error("El saldo de la zona cambió durante el movimiento. Intente nuevamente.");
        }
      }

      const saldoDestino = saldos.find((s) => s.zonaAlmacenId === zonaDestinoId);
      if (saldoDestino) {
        const reclamo = await tx.saldoZona.updateMany({
          where: { id: saldoDestino.id, cantidad: saldoDestino.cantidad },
          data: { cantidad: { increment: cantidad } },
        });
        if (reclamo.count !== 1) {
          throw new Error("El saldo de la zona cambió durante el movimiento. Intente nuevamente.");
        }
      } else {
        await tx.saldoZona.create({
          data: {
            zonaAlmacenId: zonaDestinoId,
            tipoItem,
            itemId,
            presentacionId: esPresentacion ? itemId : null,
            insumoId: esPresentacion ? null : itemId,
            cantidad,
          },
        });
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo mover el stock entre zonas." };
  }

  revalidatePath("/inventario/traslados");
  return { ok: true };
}
