export type LineaOrdenCompraNormalizada = {
  insumoId: string;
  cantidad: number;
  costoUnitario: number;
  fechaEntregaEsperada?: string;
};

export function normalizarLineasOrdenCompra(
  valor: unknown
): LineaOrdenCompraNormalizada[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaOrdenCompraNormalizada[] = [];
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("insumoId" in candidata) ||
      !("cantidad" in candidata) ||
      !("costoUnitario" in candidata) ||
      typeof candidata.insumoId !== "string" ||
      typeof candidata.cantidad !== "number" ||
      typeof candidata.costoUnitario !== "number" ||
      ("fechaEntregaEsperada" in candidata &&
        candidata.fechaEntregaEsperada !== undefined &&
        typeof candidata.fechaEntregaEsperada !== "string")
    ) {
      continue;
    }
    if (
      candidata.insumoId &&
      Number.isFinite(candidata.cantidad) &&
      candidata.cantidad > 0 &&
      Number.isFinite(candidata.costoUnitario) &&
      candidata.costoUnitario >= 0
    ) {
      lineas.push({
        insumoId: candidata.insumoId,
        cantidad: candidata.cantidad,
        costoUnitario: candidata.costoUnitario,
        ...(candidata.fechaEntregaEsperada
          ? { fechaEntregaEsperada: candidata.fechaEntregaEsperada }
          : {}),
      });
    }
  }

  return lineas;
}
