export function esCantidadAjusteMaterialValida(cantidad: number): boolean {
  return Number.isFinite(cantidad) && cantidad > 0;
}

export function costoInsumosAjustado(costoActual: number, costoMovimiento: number, esDevolucion: boolean): number | null {
  if (![costoActual, costoMovimiento].every(Number.isFinite) || costoMovimiento <= 0) return null;
  const resultado = costoActual + (esDevolucion ? -costoMovimiento : costoMovimiento);
  return resultado < -0.000001 ? null : Math.max(0, resultado);
}
