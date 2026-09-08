export function calcularStockDisponibleInsumo(stockFisico: number, reservadoProduccion: number): number {
  if (!Number.isFinite(stockFisico) || !Number.isFinite(reservadoProduccion)) return 0;
  return stockFisico - Math.max(0, reservadoProduccion);
}

export function calcularCompraNeta(consumoProyectado: number, stockMinimo: number, stockFisico: number, reservadoProduccion: number): number {
  return Math.max(0, consumoProyectado + stockMinimo - calcularStockDisponibleInsumo(stockFisico, reservadoProduccion));
}

export function ajustarCantidadCompra(necesidadNeta: number, cantidadMinima: number, multiplo: number): number {
  if (![necesidadNeta, cantidadMinima, multiplo].every(Number.isFinite) || necesidadNeta <= 0) return 0;
  const base = Math.max(necesidadNeta, Math.max(0, cantidadMinima));
  if (multiplo <= 0) return base;
  return Math.ceil((base - 1e-9) / multiplo) * multiplo;
}

export function calcularFechaEntrega(fechaBase: Date, plazoEntregaDias: number): Date {
  const resultado = new Date(fechaBase);
  resultado.setHours(12, 0, 0, 0);
  resultado.setDate(resultado.getDate() + Math.max(0, Math.trunc(plazoEntregaDias)));
  return resultado;
}
