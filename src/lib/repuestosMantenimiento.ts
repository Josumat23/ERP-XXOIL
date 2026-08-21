export type RepuestoMantenimientoNormalizado = {
  insumoId: string;
  cantidad: number;
};

export function normalizarRepuestosMantenimiento(
  valor: unknown
): RepuestoMantenimientoNormalizado[] | null {
  if (!Array.isArray(valor)) return null;

  const repuestos: RepuestoMantenimientoNormalizado[] = [];
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
      repuestos.push({ insumoId: candidato.insumoId, cantidad: candidato.cantidad });
    }
  }

  return repuestos;
}
