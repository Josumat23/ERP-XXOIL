export type DetalleFormulaNormalizado = {
  insumoId: string;
  cantidad: number;
};

export function normalizarDetallesFormula(valor: unknown): DetalleFormulaNormalizado[] | null {
  if (!Array.isArray(valor)) return null;

  const detalles: DetalleFormulaNormalizado[] = [];
  for (const candidato of valor) {
    if (
      typeof candidato !== "object" ||
      candidato === null ||
      !("insumoId" in candidato) ||
      !("cantidad" in candidato) ||
      typeof candidato.insumoId !== "string" ||
      typeof candidato.cantidad !== "number"
    ) {
      continue;
    }
    if (candidato.insumoId && Number.isFinite(candidato.cantidad) && candidato.cantidad > 0) {
      detalles.push({ insumoId: candidato.insumoId, cantidad: candidato.cantidad });
    }
  }

  return detalles;
}
