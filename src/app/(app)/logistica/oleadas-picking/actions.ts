"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroOleadaPicking } from "@/lib/correlativos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  consolidarLineas,
  esElegible,
  motivoNoElegible,
  MENSAJE_NO_ELEGIBLE,
  validarPick,
} from "@/lib/oleadaPicking";
import { puedePickearUnidad } from "@/lib/unidadesManipulacion";
import {
  distribucionZonas,
  MENSAJE_ERROR_ZONA,
  validarMovimientoEntreZonas,
} from "@/lib/saldosZona";

export type EstadoFormulario = { error?: string };

async function autorizar() {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Materiales." } as const;
  }
  return auth;
}

export async function crearOleada(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const guiaIds = formData.getAll("guiaIds").map((v) => String(v)).filter(Boolean);
  if (guiaIds.length === 0) return { error: "Seleccione al menos una guía para preparar." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // Los ids llegan del navegador: se releen acotados a la compañía activa,
      // con todo lo que hace falta para decidir si son elegibles.
      const guias = await tx.guiaRemision.findMany({
        where: { id: { in: guiaIds }, empresaId },
        include: {
          pedido: { select: { almacenId: true, requiereEntrega: true } },
          detalles: { select: { presentacionId: true, cantidad: true } },
          oleadas: { select: { oleada: { select: { id: true, estado: true } } } },
        },
      });
      if (guias.length !== guiaIds.length) {
        throw new Error("Alguna guía no pertenece a la compañía activa.");
      }

      const candidatas = guias.map((g) => ({
        id: g.id,
        numero: g.numero,
        estadoDespacho: g.estadoDespacho,
        almacenId: g.pedido?.almacenId ?? null,
        requiereEntrega: g.pedido?.requiereEntrega ?? false,
        oleadaAbiertaId: g.oleadas.find((o) => o.oleada.estado === "ABIERTA")?.oleada.id ?? null,
      }));

      const rechazada = candidatas.find((c) => !esElegible(c));
      if (rechazada) {
        const motivo = motivoNoElegible(rechazada)!;
        throw new Error(`${rechazada.numero}: ${MENSAJE_NO_ELEGIBLE[motivo]}`);
      }

      // Una recorrida ocurre en un solo lugar.
      const almacenes = new Set(candidatas.map((c) => c.almacenId));
      if (almacenes.size > 1) {
        throw new Error("Las guías salen de almacenes distintos: una oleada se camina en uno solo.");
      }
      const almacenId = candidatas[0].almacenId!;

      const lineas = consolidarLineas(
        guias.map((g) => g.detalles.map((d) => ({ presentacionId: d.presentacionId, cantidad: d.cantidad })))
      );
      if (lineas.length === 0) throw new Error("Las guías elegidas no tienen líneas que preparar.");

      const numero = await siguienteNumeroOleadaPicking(tx, empresaId);
      await tx.oleadaPicking.create({
        data: {
          empresaId,
          numero,
          almacenId,
          notas: String(formData.get("notas") ?? "").trim() || null,
          usuarioId: auth.usuario.id,
          usuarioNombre: auth.usuario.nombre,
          guias: { create: guiaIds.map((guiaId) => ({ guiaId })) },
          lineas: {
            create: lineas.map((l) => ({
              presentacionId: l.presentacionId,
              cantidadRequerida: l.cantidad,
            })),
          },
        },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo armar la oleada." };
  }

  revalidatePath("/logistica/oleadas-picking");
  return {};
}

/**
 * Registrar lo preparado de una línea, tomándolo de una zona concreta.
 *
 * El movimiento es zona → «sin zona»: el ítem sale del rack y queda en la
 * playa de despacho, que no es una zona de almacenamiento. El kardex no se
 * toca — eso lo hace la guía al salir.
 */
export async function registrarPick(
  lineaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const cantidad = Number(formData.get("cantidad"));
  const zonaOrigenId = String(formData.get("zonaOrigenId") ?? "").trim() || null;
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      // El id de la línea llega del navegador: se relee con su oleada, acotada
      // a la compañía activa.
      const linea = await tx.pickingLinea.findFirst({
        where: { id: lineaId, oleada: { empresaId } },
        include: { oleada: { select: { id: true, estado: true, almacenId: true } } },
      });
      if (!linea) throw new Error("La línea no pertenece a la compañía activa.");
      if (linea.oleada.estado !== "ABIERTA") {
        throw new Error("La oleada ya no está abierta.");
      }

      const [saldoAlmacen, saldos] = await Promise.all([
        tx.saldoAlmacen.findFirst({
          where: {
            almacenId: linea.oleada.almacenId,
            tipoItem: "PRESENTACION",
            presentacionId: linea.presentacionId,
            insumoId: null,
          },
        }),
        tx.saldoZona.findMany({
          where: { itemId: linea.presentacionId, zona: { almacenId: linea.oleada.almacenId } },
        }),
      ]);

      const distribucion = distribucionZonas(
        saldoAlmacen?.cantidad.toNumber() ?? 0,
        saldos.map((s) => ({ zonaAlmacenId: s.zonaAlmacenId, cantidad: s.cantidad.toNumber() }))
      );
      const disponible =
        zonaOrigenId === null
          ? distribucion.sinZona
          : distribucion.porZona.find((z) => z.zonaAlmacenId === zonaOrigenId)?.cantidad ?? 0;

      const error = validarPick(
        {
          cantidadRequerida: linea.cantidadRequerida.toNumber(),
          cantidadPickeada: linea.cantidadPickeada.toNumber(),
        },
        cantidad,
        disponible
      );
      if (error) throw new Error(error);

      // Tomar de «sin zona» no mueve nada en la capa de zonas: ya estaba sin
      // asignar. Solo se descuenta cuando sale de una zona concreta.
      if (zonaOrigenId !== null) {
        const errorZona = validarMovimientoEntreZonas(
          { zonaOrigenId, zonaDestinoId: null, cantidad },
          distribucion
        );
        if (errorZona) throw new Error(MENSAJE_ERROR_ZONA[errorZona]);

        const saldoOrigen = saldos.find((s) => s.zonaAlmacenId === zonaOrigenId);
        if (!saldoOrigen) throw new Error(MENSAJE_ERROR_ZONA.SIN_SALDO_EN_ORIGEN);
        // Reclamo optimista sobre la cantidad leída, igual que el reparto
        // manual entre zonas.
        const reclamo = await tx.saldoZona.updateMany({
          where: { id: saldoOrigen.id, cantidad: saldoOrigen.cantidad },
          data: { cantidad: { decrement: cantidad } },
        });
        if (reclamo.count !== 1) {
          throw new Error("El saldo de la zona cambió durante la preparación. Intente nuevamente.");
        }
      }

      const avance = await tx.pickingLinea.updateMany({
        where: { id: lineaId, cantidadPickeada: linea.cantidadPickeada },
        data: { cantidadPickeada: { increment: cantidad } },
      });
      if (avance.count !== 1) {
        throw new Error("Otra persona registró preparación en esta línea. Intente nuevamente.");
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar la preparación." };
  }

  revalidatePath("/logistica/oleadas-picking");
  return {};
}

/**
 * Preparar una unidad de manipulación completa.
 *
 * Es la razón por la que las HU existen: en vez de contar 40 unidades, se baja
 * el pallet entero y la oleada avanza de una. El efecto sobre el stock es el
 * mismo que preparar por cantidad —el saldo del almacén no se toca y el de la
 * zona baja—, más que la unidad deja la zona y pasa a la playa de despacho.
 */
export async function pickearUnidad(
  oleadaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const unidadId = String(formData.get("unidadId") ?? "").trim();
  if (!unidadId) return { error: "Elija la unidad a preparar." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      // Los dos ids llegan del navegador.
      const oleada = await tx.oleadaPicking.findFirst({
        where: { id: oleadaId, empresaId },
        include: { lineas: true },
      });
      if (!oleada) throw new Error("La oleada no pertenece a la compañía activa.");
      if (oleada.estado !== "ABIERTA") throw new Error("La oleada ya no está abierta.");

      const unidad = await tx.unidadManipulacion.findFirst({
        where: { id: unidadId, empresaId },
        include: { contenidos: true, zona: { select: { id: true, almacenId: true } } },
      });
      if (!unidad) throw new Error("La unidad no pertenece a la compañía activa.");
      if (!unidad.zona) throw new Error("La unidad ya no está en una zona del almacén.");
      // Una recorrida ocurre en un almacén: bajar un pallet de otro sería
      // preparar stock que no es el de esta oleada.
      if (unidad.zona.almacenId !== oleada.almacenId) {
        throw new Error("La unidad está en otro almacén distinto al de la oleada.");
      }

      const contenidos = unidad.contenidos.map((c) => ({
        presentacionId: c.presentacionId,
        cantidad: c.cantidad.toNumber(),
      }));
      const veredicto = puedePickearUnidad(
        contenidos,
        oleada.lineas.map((l) => ({
          presentacionId: l.presentacionId,
          pendiente: l.cantidadRequerida.toNumber() - l.cantidadPickeada.toNumber(),
        }))
      );
      if (!veredicto.puede) throw new Error(veredicto.motivo);

      for (const item of veredicto.aplicar) {
        // Baja el saldo de la zona, igual que el picking por cantidad.
        const saldo = await tx.saldoZona.findFirst({
          where: { zonaAlmacenId: unidad.zona.id, itemId: item.presentacionId },
        });
        if (!saldo || saldo.cantidad.toNumber() < item.cantidad) {
          throw new Error("El saldo de la zona no alcanza para bajar la unidad completa.");
        }
        const reclamo = await tx.saldoZona.updateMany({
          where: { id: saldo.id, cantidad: saldo.cantidad },
          data: { cantidad: { decrement: item.cantidad } },
        });
        if (reclamo.count !== 1) {
          throw new Error("El saldo de la zona cambió durante la preparación. Intente nuevamente.");
        }

        const linea = oleada.lineas.find((l) => l.presentacionId === item.presentacionId)!;
        const avance = await tx.pickingLinea.updateMany({
          where: { id: linea.id, cantidadPickeada: linea.cantidadPickeada },
          data: { cantidadPickeada: { increment: item.cantidad } },
        });
        if (avance.count !== 1) {
          throw new Error("Otra persona registró preparación en esta línea. Intente nuevamente.");
        }
      }

      // La unidad sale de la zona y espera en la playa: su contenido ya no
      // suma al saldo de ninguna zona.
      await tx.unidadManipulacion.update({
        where: { id: unidadId },
        data: { zonaAlmacenId: null, estado: "EN_PLAYA" },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo preparar la unidad." };
  }

  revalidatePath("/logistica/oleadas-picking");
  revalidatePath("/logistica/unidades-manipulacion");
  return {};
}

// Completar con faltante está permitido a propósito: si no hay stock, la
// oleada se cierra igual y el faltante queda a la vista. Bloquearla dejaría al
// almacén sin poder cerrar el trabajo del día por una unidad que no apareció.
export async function completarOleada(
  oleadaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  const cerrada = await prisma.oleadaPicking.updateMany({
    where: { id: oleadaId, empresaId, estado: "ABIERTA" },
    data: {
      estado: "COMPLETADA",
      completadaEn: new Date(),
      completadaPorId: auth.usuario.id,
      completadaPorNombre: auth.usuario.nombre,
      notas: String(formData.get("notas") ?? "").trim() || undefined,
    },
  });
  if (cerrada.count !== 1) return { error: "La oleada ya no está abierta." };

  revalidatePath("/logistica/oleadas-picking");
  return {};
}

export async function cancelarOleada(
  oleadaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Indique por qué se cancela la oleada." };
  if (motivo.length > 500) return { error: "El motivo no puede superar 500 caracteres." };

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const oleada = await tx.oleadaPicking.findFirst({
        where: { id: oleadaId, empresaId },
        include: { lineas: { select: { cantidadPickeada: true } } },
      });
      if (!oleada || oleada.estado !== "ABIERTA") throw new Error("La oleada ya no está abierta.");

      // Con mercadería ya bajada del rack, cancelar exigiría decidir a qué
      // zona vuelve cada unidad, y el sistema no sabe dónde la dejaron. Se
      // devuelve desde el reparto entre zonas, que es donde esa decisión se
      // toma a conciencia.
      const pickeado = oleada.lineas.reduce((t, l) => t + l.cantidadPickeada.toNumber(), 0);
      if (pickeado > 0) {
        throw new Error(
          "La oleada ya tiene mercadería preparada: complétela y devuelva el stock a su zona desde Inventario → Traslados."
        );
      }

      await tx.oleadaPicking.update({
        where: { id: oleadaId },
        data: { estado: "CANCELADA", motivoCancelacion: motivo },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cancelar la oleada." };
  }

  revalidatePath("/logistica/oleadas-picking");
  return {};
}
