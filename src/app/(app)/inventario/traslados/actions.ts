"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarMovimiento } from "@/lib/inventario";
import { siguienteCodigoTraslado } from "@/lib/correlativos";

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
      const referencia = await siguienteCodigoTraslado(tx);

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

  const zonaDestino = await prisma.zonaAlmacen.findUnique({ where: { id: zonaDestinoId } });
  if (!zonaDestino) return { error: "La zona destino no existe." };

  if (tipoItem === "PRESENTACION") {
    const item = await prisma.presentacion.findUnique({ where: { id: itemId } });
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
    const item = await prisma.insumo.findUnique({ where: { id: itemId } });
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
