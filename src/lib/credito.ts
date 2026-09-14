export type EvaluacionCredito = {
  excede: boolean;
  deudaActual: number;
  montoFactura: number;
  exposicionProyectada: number;
  limite: number | null;
};

/**
 * ¿La operación excede el techo del cliente?
 *
 * `limite` tiene tres estados y ninguno es un número mágico:
 *   `null` = sin tope, heredado de antes del 2026-09-14 y sin evaluar nunca
 *   `0`    = SIN CRÉDITO: cualquier exposición a crédito lo excede
 *   `> 0`  = el techo real
 *
 * Hasta el 2026-09-14 la condición era `limite > 0 && ...`, o sea que un 0
 * dejaba pasar cualquier monto. El valor con el que nace todo cliente nuevo
 * era el más permisivo del sistema.
 *
 * Esto NO decide si hay que evaluar: una venta al contado no se evalúa, y eso
 * lo resuelve quien llama. Pasarle 0 para decir «no evalúes» era el tercer
 * significado del mismo número.
 */
export function evaluarCredito(
  deudaActual: number,
  montoFactura: number,
  limite: number | null
): EvaluacionCredito {
  const exposicionProyectada = deudaActual + montoFactura;
  return {
    excede: limite !== null && exposicionProyectada > limite + 1e-9,
    deudaActual,
    montoFactura,
    exposicionProyectada,
    limite,
  };
}

export function coincideEvaluacionCredito(
  valorGuardado: { toNumber(): number } | null,
  valorActual: number | null
): boolean {
  // Un cliente sin tope (`null`) nunca llega a exceder, así que esta rama
  // no debería alcanzarse; se define igual para no obligar a quien llama a
  // inventar un número que represente «sin tope».
  if (valorActual === null) return valorGuardado === null;
  return valorGuardado !== null && Math.abs(valorGuardado.toNumber() - valorActual) <= 1e-9;
}
type NumeroDecimal = { toNumber(): number } | null;

type AprobacionCreditoGuardada = {
  estadoAprobacionCredito: "NO_REQUERIDA" | "PENDIENTE" | "APROBADA" | "RECHAZADA";
  condicionPagoCredito: "CONTADO" | "DIAS_15" | "DIAS_30" | null;
  deudaCreditoEvaluada: NumeroDecimal;
  montoCreditoEvaluado: NumeroDecimal;
  limiteCreditoEvaluado: NumeroDecimal;
};

export function esAprobacionCreditoVigente(
  guardada: AprobacionCreditoGuardada,
  actual: {
    condicionPago: "CONTADO" | "DIAS_15" | "DIAS_30";
    deudaActual: number;
    montoFactura: number;
    limite: number | null;
  }
): boolean {
  return (
    guardada.estadoAprobacionCredito === "APROBADA" &&
    guardada.condicionPagoCredito === actual.condicionPago &&
    coincideEvaluacionCredito(guardada.deudaCreditoEvaluada, actual.deudaActual) &&
    coincideEvaluacionCredito(guardada.montoCreditoEvaluado, actual.montoFactura) &&
    coincideEvaluacionCredito(guardada.limiteCreditoEvaluado, actual.limite)
  );
}
