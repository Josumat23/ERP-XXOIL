export type LineaReglaAsignacionNormalizada = {
  centroCostoId: string;
  porcentaje: number;
};

export function normalizarLineasReglaAsignacion(
  valor: unknown
): LineaReglaAsignacionNormalizada[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaReglaAsignacionNormalizada[] = [];
  const centros = new Set<string>();
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("centroCostoId" in candidata) ||
      !("porcentaje" in candidata) ||
      typeof candidata.centroCostoId !== "string" ||
      typeof candidata.porcentaje !== "number"
    ) {
      continue;
    }

    const centroCostoId = candidata.centroCostoId.trim();
    if (
      !centroCostoId ||
      !Number.isFinite(candidata.porcentaje) ||
      candidata.porcentaje <= 0 ||
      candidata.porcentaje > 100
    ) {
      continue;
    }
    if (centros.has(centroCostoId)) return null;

    centros.add(centroCostoId);
    lineas.push({ centroCostoId, porcentaje: candidata.porcentaje });
  }

  return lineas;
}
