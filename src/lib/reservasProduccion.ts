export function calcularStockDisponibleInsumo(stockFisico: number, reservadoProduccion: number): number {
  if (!Number.isFinite(stockFisico) || !Number.isFinite(reservadoProduccion)) return 0;
  return stockFisico - Math.max(0, reservadoProduccion);
}

export function calcularCompraNeta(consumoProyectado: number, stockMinimo: number, stockFisico: number, reservadoProduccion: number): number {
  return Math.max(0, consumoProyectado + stockMinimo - calcularStockDisponibleInsumo(stockFisico, reservadoProduccion));
}
