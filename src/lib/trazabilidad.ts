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
  params: { pedidoDetalleId: string; presentacionId: string; cantidad: number }
): Promise<void> {
  const { pedidoDetalleId, presentacionId, cantidad } = params;
  let restante = cantidad;

  const envasados = await tx.envasado.findMany({
    where: { presentacionId, unidadesDisponibles: { gt: 0 } },
    orderBy: { fecha: "asc" },
  });

  for (const e of envasados) {
    if (restante <= 0) break;
    const tomar = Math.min(restante, e.unidadesDisponibles);
    if (tomar <= 0) continue;

    await tx.asignacionLoteVenta.create({
      data: { pedidoDetalleId, envasadoId: e.id, tipo: "ASIGNADA", cantidad: tomar },
    });
    await tx.envasado.update({
      where: { id: e.id },
      data: { unidadesDisponibles: { decrement: tomar } },
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

    await tx.asignacionLoteInsumo.create({
      data: { loteGranelId, recepcionCompraDetalleId: r.id, cantidad: tomar },
    });
    await tx.recepcionCompraDetalle.update({
      where: { id: r.id },
      data: { cantidadDisponible: { decrement: tomar } },
    });
    restante -= tomar;
  }
  // Si restante > 0, no se pudo trazar todo (ej. stock cargado antes de este
  // feature) — no es un error, best-effort igual que asignarLoteVenta.
}

/**
 * Libera asignaciones vigentes de una línea de pedido, por anulación (toda la
 * línea) o devolución física (una cantidad parcial). Calcula el neto vigente
 * por envasado (ASIGNADA − LIBERADA de eventos previos) para no liberar de
 * más si ya hubo una devolución parcial anterior sobre la misma línea.
 */
export async function liberarAsignacionesLote(
  tx: Tx,
  params: { pedidoDetalleId: string; motivo: string; cantidad?: number }
): Promise<void> {
  const { pedidoDetalleId, motivo, cantidad } = params;

  const eventos = await tx.asignacionLoteVenta.findMany({
    where: { pedidoDetalleId },
    orderBy: { creadoEn: "asc" },
  });

  const netoPorEnvasado = new Map<string, number>();
  for (const e of eventos) {
    const actual = netoPorEnvasado.get(e.envasadoId) ?? 0;
    netoPorEnvasado.set(e.envasadoId, actual + (e.tipo === "ASIGNADA" ? e.cantidad : -e.cantidad));
  }

  let restante = cantidad ?? [...netoPorEnvasado.values()].reduce((a, b) => a + b, 0);

  for (const [envasadoId, disponible] of netoPorEnvasado) {
    if (restante <= 0) break;
    if (disponible <= 0) continue;
    const liberar = Math.min(restante, disponible);

    await tx.asignacionLoteVenta.create({
      data: { pedidoDetalleId, envasadoId, tipo: "LIBERADA", cantidad: liberar, motivo },
    });
    await tx.envasado.update({
      where: { id: envasadoId },
      data: { unidadesDisponibles: { increment: liberar } },
    });
    restante -= liberar;
  }
}
