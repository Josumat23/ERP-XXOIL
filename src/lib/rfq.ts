export type LineaRfqNormalizada = { insumoId: string; cantidad: number };
export type LineaOfertaRfqNormalizada = { rfqLineaId: string; costoUnitario: number };

function registro(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : null;
}

export function normalizarLineasRfq(valor: unknown): LineaRfqNormalizada[] | null {
  if (!Array.isArray(valor)) return null;
  const resultado: LineaRfqNormalizada[] = [];
  const vistos = new Set<string>();
  for (const candidata of valor) {
    const linea = registro(candidata);
    if (!linea) return null;
    const insumoId = typeof linea.insumoId === "string" ? linea.insumoId.trim() : "";
    const cantidad = Number(linea.cantidad);
    if (!insumoId || !Number.isFinite(cantidad) || cantidad <= 0 || vistos.has(insumoId)) return null;
    vistos.add(insumoId);
    resultado.push({ insumoId, cantidad });
  }
  return resultado;
}

export function normalizarLineasOfertaRfq(valor: unknown): LineaOfertaRfqNormalizada[] | null {
  if (!Array.isArray(valor)) return null;
  const resultado: LineaOfertaRfqNormalizada[] = [];
  const vistos = new Set<string>();
  for (const candidata of valor) {
    const linea = registro(candidata);
    if (!linea) return null;
    const rfqLineaId = typeof linea.rfqLineaId === "string" ? linea.rfqLineaId.trim() : "";
    const costoUnitario = Number(linea.costoUnitario);
    if (!rfqLineaId || !Number.isFinite(costoUnitario) || costoUnitario < 0 || vistos.has(rfqLineaId)) return null;
    vistos.add(rfqLineaId);
    resultado.push({ rfqLineaId, costoUnitario });
  }
  return resultado;
}

export function totalOfertaEnPen(total: number, moneda: string, tipoCambio: number): number {
  if (!Number.isFinite(total) || total < 0) throw new Error("El total de la oferta es inválido.");
  if (moneda === "PEN") return total;
  if (moneda !== "USD" || !Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    throw new Error("La moneda o el tipo de cambio de la oferta es inválido.");
  }
  return total * tipoCambio;
}
