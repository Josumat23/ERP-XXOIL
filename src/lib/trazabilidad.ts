import type { Tx } from "@/lib/inventario";

// ---------------------------------------------------------------------------
// Trazabilidad de lote: qué envasado(s) — y por lo tanto qué lote granel —
// terminó en manos de qué cliente. Necesario para poder responder, ante un
// reclamo de calidad o un recall, "¿a quién le vendimos el lote X?".
// Best-effort: si no hay envasados con saldo suficiente para cubrir la venta
// (por ejemplo, stock cargado antes de este feature o por ajuste manual), la
// venta NO se bloquea — simplemente esa porción queda sin lote asignado,
// igual que la contabilización automática es best-effort en este sistema.
// ---------------------------------------------------------------------------

/** Asigna FIFO (por fecha de envasado) la cantidad vendida de una línea de pedido a los envasados con saldo disponible. */
export async function asignarLoteVenta(
  tx: Tx,
  params: { facturaDetalleId?: string; guiaDetalleId?: string; pedidoDetalleId: string; presentacionId: string; cantidad: number }
): Promise<void> {
  const { facturaDetalleId, guiaDetalleId, pedidoDetalleId, presentacionId, cantidad } = params;
  if ((facturaDetalleId ? 1 : 0) + (guiaDetalleId ? 1 : 0) !== 1) {
    throw new Error("La asignación de lote requiere una única línea de factura o entrega.");
  }
  let restante = cantidad;

  const envasados = await tx.envasado.findMany({
    where: { presentacionId, unidadesDisponibles: { gt: 0 } },
    orderBy: { fecha: "asc" },
  });

  for (const e of envasados) {
    if (restante <= 0) break;
    const tomar = Math.min(restante, e.unidadesDisponibles);
    if (tomar <= 0) continue;

    const reclamo = await tx.envasado.updateMany({
      where: { id: e.id, unidadesDisponibles: { gte: tomar } },
      data: { unidadesDisponibles: { decrement: tomar } },
    });
    if (reclamo.count !== 1) continue;

    await tx.asignacionLoteVenta.create({
      data: { facturaDetalleId, guiaDetalleId, pedidoDetalleId, envasadoId: e.id, tipo: "ASIGNADA", cantidad: tomar },
    });
    restante -= tomar;
  }
  // Si restante > 0, no se pudo trazar todo (ver nota arriba) — no es un error.
}

/**
 * Asigna FIFO (por fecha de recepción) el consumo de insumo de un lote
 * granel a las recepciones de compra con saldo disponible. A diferencia de
 * la asignación de venta, no hay "liberación": un lote granel no se anula,
 * así que es un ledger de solo consumo.
 */
export async function asignarLoteInsumo(
  tx: Tx,
  params: { loteGranelId: string; insumoId: string; cantidad: number }
): Promise<void> {
  const { loteGranelId, insumoId, cantidad } = params;
  let restante = cantidad;

  const recepciones = await tx.recepcionCompraDetalle.findMany({
    where: { insumoId, cantidadDisponible: { gt: 0 } },
    include: { recepcion: true },
    orderBy: { recepcion: { fecha: "asc" } },
  });

  for (const r of recepciones) {
    if (restante <= 0) break;
    const disponible = r.cantidadDisponible.toNumber();
    const tomar = Math.min(restante, disponible);
    if (tomar <= 0) continue;

    const reclamo = await tx.recepcionCompraDetalle.updateMany({
      where: { id: r.id, cantidadDisponible: { gte: tomar } },
      data: { cantidadDisponible: { decrement: tomar } },
    });
    if (reclamo.count !== 1) continue;

    await tx.asignacionLoteInsumo.create({
      data: { loteGranelId, recepcionCompraDetalleId: r.id, cantidad: tomar },
    });
    restante -= tomar;
  }
  // Si restante > 0, no se pudo trazar todo (ej. stock cargado antes de este
  // feature) — no es un error, best-effort igual que asignarLoteVenta.
}

/** Devuelve FIFO trazado al almacén mediante eventos compensatorios, sin borrar el consumo original. */
export async function devolverLoteInsumo(
  tx: Tx,
  params: { loteGranelId: string; insumoId: string; cantidad: number; movimientoMaterialId: string }
): Promise<void> {
  const asignaciones = await tx.asignacionLoteInsumo.findMany({
    where: { loteGranelId: params.loteGranelId, recepcionCompraDetalle: { insumoId: params.insumoId } },
    include: { devolucionAsignacionLoteInsumos: true },
    orderBy: { creadoEn: "desc" },
  });
  const disponibles = asignaciones.map((asignacion) => ({
    ...asignacion,
    neto: asignacion.cantidad.toNumber() - asignacion.devolucionAsignacionLoteInsumos.reduce((total, devolucion) => total + devolucion.cantidad.toNumber(), 0),
  }));
  const totalDisponible = disponibles.reduce((total, asignacion) => total + asignacion.neto, 0);
  if (params.cantidad > totalDisponible + 0.000001) throw new Error("La devolución supera el consumo trazado pendiente del insumo.");
  let restante = params.cantidad;
  for (const asignacion of disponibles) {
    if (restante <= 0.000001) break;
    const cantidad = Math.min(restante, asignacion.neto);
    if (cantidad <= 0) continue;
    await tx.devolucionAsignacionLoteInsumo.create({ data: { movimientoMaterialId: params.movimientoMaterialId, asignacionLoteInsumoId: asignacion.id, cantidad } });
    await tx.recepcionCompraDetalle.update({ where: { id: asignacion.recepcionCompraDetalleId }, data: { cantidadDisponible: { increment: cantidad } } });
    restante -= cantidad;
  }
}

/**
 * Libera asignaciones vigentes de una línea de pedido, por anulación (toda la
 * línea) o devolución física (una cantidad parcial). Calcula el neto vigente
 * por envasado (ASIGNADA − LIBERADA de eventos previos) para no liberar de
 * más si ya hubo una devolución parcial anterior sobre la misma línea.
 */
export async function liberarAsignacionesLote(
  tx: Tx,
  params: { facturaDetalleId?: string; guiaDetalleId?: string; devolucionDetalleId?: string; pedidoDetalleId: string; motivo: string; cantidad?: number; restaurarDisponible?: boolean }
): Promise<number> {
  const { facturaDetalleId, guiaDetalleId, devolucionDetalleId, pedidoDetalleId, motivo, cantidad, restaurarDisponible = true } = params;
  if ((facturaDetalleId ? 1 : 0) + (guiaDetalleId ? 1 : 0) < 1) {
    throw new Error("La liberación de lote requiere una línea de factura o entrega.");
  }

  const eventos = await tx.asignacionLoteVenta.findMany({
    where: guiaDetalleId ? { guiaDetalleId } : { facturaDetalleId },
    orderBy: { creadoEn: "asc" },
  });

  const netoPorEnvasado = new Map<string, number>();
  for (const e of eventos) {
    const actual = netoPorEnvasado.get(e.envasadoId) ?? 0;
    netoPorEnvasado.set(e.envasadoId, actual + (e.tipo === "ASIGNADA" ? e.cantidad : -e.cantidad));
  }

  let restante = cantidad ?? [...netoPorEnvasado.values()].reduce((a, b) => a + b, 0);
  const solicitado = restante;

  for (const [envasadoId, disponible] of netoPorEnvasado) {
    if (restante <= 0) break;
    if (disponible <= 0) continue;
    const liberar = Math.min(restante, disponible);

    await tx.asignacionLoteVenta.create({
      data: { facturaDetalleId, guiaDetalleId, devolucionDetalleId, pedidoDetalleId, envasadoId, tipo: "LIBERADA", cantidad: liberar, motivo },
    });
    if (restaurarDisponible) {
      await tx.envasado.update({
        where: { id: envasadoId },
        data: { unidadesDisponibles: { increment: liberar } },
      });
    }
    restante -= liberar;
  }
  return solicitado - restante;
}
