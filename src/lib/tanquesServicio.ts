// Sin `server-only`, como `inventario.ts` y `trazabilidad.ts`: estas funciones
// reciben la transacción y no abren conexión propia, así que la suite puede
// ejercerlas directamente. Un servicio que no se puede probar no se prueba.
import type { Tx } from "@/lib/inventario";
import {
  cabeEnTanque,
  contenidoTanque,
  MENSAJE_ERROR_TANQUE,
  repartirConsumo,
  type AporteTanque,
} from "@/lib/tanques";

// Las dos operaciones de un tanque contra la base: descargar una recepción y
// consumir hacia un lote de producción.
//
// El reparto proporcional vive en `@/lib/tanques` como función pura y probada.
// Acá está lo que no se puede probar sin base: que la descarga y el consumo
// dejen la contabilidad de kilos cuadrada dentro de UNA transacción.
//
// Lo que hace que esto no rompa la trazabilidad existente: al consumir, el
// tanque genera una `AsignacionLoteInsumo` **por cada recepción que aporta**,
// con su parte proporcional. La cadena LoteGranel → AsignacionLoteInsumo →
// RecepcionCompraDetalle → lote del proveedor sigue igual, y ahora además dice
// con qué porcentaje participó cada lote.

export type ResultadoTanque = { ok: true } | { ok: false; error: string };

/**
 * Descarga una recepción dentro de un tanque.
 *
 * El stock deja de estar disponible como envase suelto y pasa a ser parte del
 * contenido del tanque: `cantidadDisponible` de la recepción baja y aparece un
 * `AporteTanque`. No se puede descargar dos veces lo mismo porque lo que se
 * mueve es la disponibilidad, no un permiso.
 */
export async function descargarEnTanque(
  tx: Tx,
  params: {
    tanqueId: string;
    recepcionCompraDetalleId: string;
    cantidadKg: number;
    empresaId: string;
  }
): Promise<ResultadoTanque> {
  const { tanqueId, recepcionCompraDetalleId, cantidadKg, empresaId } = params;

  const tanque = await tx.tanque.findFirst({
    where: { id: tanqueId, empresaId, activo: true },
  });
  if (!tanque) return { ok: false, error: "El tanque no existe o no es de la compañía activa." };

  const detalle = await tx.recepcionCompraDetalle.findFirst({
    where: { id: recepcionCompraDetalleId, recepcion: { empresaId } },
  });
  if (!detalle) {
    return { ok: false, error: "La recepción no existe o no es de la compañía activa." };
  }

  // Un tanque contiene UN insumo. Mezclar productos distintos no es un caso a
  // soportar: es un incidente, y el sistema no debe ayudar a provocarlo.
  if (detalle.insumoId !== tanque.insumoId) {
    return {
      ok: false,
      error:
        "Ese insumo no es el del tanque. Un tanque contiene un solo producto: descargar otro lo contamina.",
    };
  }

  if (!Number.isFinite(cantidadKg) || cantidadKg <= 0) {
    return { ok: false, error: MENSAJE_ERROR_TANQUE.CANTIDAD_INVALIDA };
  }
  if (cantidadKg > detalle.cantidadDisponible.toNumber() + 1e-9) {
    return {
      ok: false,
      error: "La recepción no tiene esa cantidad disponible para descargar.",
    };
  }

  const cabe = cabeEnTanque({
    contenidoActualKg: tanque.contenidoKg.toNumber(),
    capacidadKg: tanque.capacidadKg.toNumber(),
    descargaKg: cantidadKg,
  });
  if (cabe !== true) return { ok: false, error: MENSAJE_ERROR_TANQUE[cabe] };

  // La disponibilidad se mueve: del envase al tanque. `updateMany` con la
  // condición de saldo es el reclamo optimista que evita que dos descargas
  // simultáneas vacíen la misma recepción dos veces.
  const reclamo = await tx.recepcionCompraDetalle.updateMany({
    where: { id: recepcionCompraDetalleId, cantidadDisponible: { gte: cantidadKg } },
    data: { cantidadDisponible: { decrement: cantidadKg } },
  });
  if (reclamo.count !== 1) {
    return { ok: false, error: "Otra operación tomó ese saldo: vuelva a intentarlo." };
  }

  await tx.aporteTanque.create({
    data: {
      tanqueId,
      recepcionCompraDetalleId,
      cantidadKg,
      cantidadInicialKg: cantidadKg,
    },
  });
  await tx.tanque.update({
    where: { id: tanqueId },
    data: { contenidoKg: { increment: cantidadKg } },
  });

  return { ok: true };
}

/**
 * Consume de un tanque hacia un lote de producción, repartiendo entre lotes.
 *
 * Éste es el punto del diseño. SAP obliga a **elegir un lote** al consumir de
 * una ubicación con varios, así que su registro afirma «salió del lote A»
 * cuando salió de una mezcla — una respuesta equivocada con aire de certeza.
 * Acá se reparte en proporción y se dice la verdad.
 */
export async function consumirDeTanque(
  tx: Tx,
  params: { tanqueId: string; loteGranelId: string; cantidadKg: number; empresaId: string }
): Promise<ResultadoTanque> {
  const { tanqueId, loteGranelId, cantidadKg, empresaId } = params;

  const tanque = await tx.tanque.findFirst({
    where: { id: tanqueId, empresaId, activo: true },
    include: { aportes: { where: { cantidadKg: { gt: 0 } }, orderBy: { ingresadoEn: "asc" } } },
  });
  if (!tanque) return { ok: false, error: "El tanque no existe o no es de la compañía activa." };

  const aportes: AporteTanque[] = tanque.aportes.map((a) => ({
    recepcionCompraDetalleId: a.recepcionCompraDetalleId,
    cantidadKg: a.cantidadKg.toNumber(),
  }));

  const reparto = repartirConsumo(aportes, cantidadKg);
  if (typeof reparto === "string") return { ok: false, error: MENSAJE_ERROR_TANQUE[reparto] };

  // Una asignación por recepción que aporta. La trazabilidad existente no
  // cambia de forma: cambia de cardinalidad.
  for (const linea of reparto) {
    const aporte = tanque.aportes.find(
      (a) => a.recepcionCompraDetalleId === linea.recepcionCompraDetalleId
    );
    if (!aporte) return { ok: false, error: "El contenido del tanque cambió: vuelva a intentarlo." };

    const reclamo = await tx.aporteTanque.updateMany({
      where: { id: aporte.id, cantidadKg: { gte: linea.cantidadKg } },
      data: { cantidadKg: { decrement: linea.cantidadKg } },
    });
    if (reclamo.count !== 1) {
      return { ok: false, error: "Otra operación consumió del tanque: vuelva a intentarlo." };
    }

    await tx.asignacionLoteInsumo.create({
      data: {
        loteGranelId,
        recepcionCompraDetalleId: linea.recepcionCompraDetalleId,
        cantidad: linea.cantidadKg,
      },
    });
  }

  await tx.tanque.update({
    where: { id: tanqueId },
    data: { contenidoKg: { decrement: cantidadKg } },
  });

  return { ok: true };
}

/**
 * El contenido del tanque recalculado desde sus aportes.
 *
 * `Tanque.contenidoKg` se mantiene para no recalcularlo en cada consulta de
 * stock, y eso lo vuelve un dato que puede desincronizarse. Esto existe para
 * poder comprobarlo — un total que nadie contrasta contra su detalle es un
 * total en el que no se puede confiar.
 */
export async function contenidoRealTanque(
  tx: Tx,
  tanqueId: string
): Promise<number> {
  const aportes = await tx.aporteTanque.findMany({
    where: { tanqueId },
    select: { cantidadKg: true },
  });
  return contenidoTanque(aportes.map((a) => ({ recepcionCompraDetalleId: "", cantidadKg: a.cantidadKg.toNumber() })));
}
