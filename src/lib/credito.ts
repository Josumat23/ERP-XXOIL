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