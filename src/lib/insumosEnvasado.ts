export type InsumoEnvasadoNormalizado = {
  insumoId: string;
  cantidad: number;
};

export function normalizarInsumosEnvasado(valor: unknown): InsumoEnvasadoNormalizado[] | null {
  if (!Array.isArray(valor)) return null;

  const insumos: InsumoEnvasadoNormalizado[] = [];
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
      insumos.push({ insumoId: candidato.insumoId, cantidad: candidato.cantidad });
    }
  }

  return insumos;
}
