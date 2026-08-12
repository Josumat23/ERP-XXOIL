export type EvaluacionCredito = {
  excede: boolean;
  deudaActual: number;
  montoFactura: number;
  exposicionProyectada: number;
  limite: number;
};

export function evaluarCredito(
  deudaActual: number,
  montoFactura: number,
  limite: number
): EvaluacionCredito {
  const exposicionProyectada = deudaActual + montoFactura;
  return {
    excede: limite > 0 && exposicionProyectada > limite + 1e-9,
    deudaActual,
    montoFactura,
    exposicionProyectada,
    limite,
  };
}

export function coincideEvaluacionCredito(
  valorGuardado: { toNumber(): number } | null,
  valorActual: number
): boolean {
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
    limite: number;
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
