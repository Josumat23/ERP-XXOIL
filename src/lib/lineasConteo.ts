export type LineaConteoNormalizada = {
  tipoItem: "PRESENTACION" | "INSUMO";
  itemId: string;
  cantidadContada: number;
};

export function normalizarLineasConteo(valor: unknown): LineaConteoNormalizada[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaConteoNormalizada[] = [];
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("tipoItem" in candidata) ||
      !("itemId" in candidata) ||
      !("cantidadContada" in candidata) ||
      (candidata.tipoItem !== "PRESENTACION" && candidata.tipoItem !== "INSUMO") ||
      typeof candidata.itemId !== "string" ||
      typeof candidata.cantidadContada !== "number"
    ) {
      continue;
    }
    if (
      candidata.itemId &&
      Number.isFinite(candidata.cantidadContada) &&
      candidata.cantidadContada >= 0
    ) {
      lineas.push({
        tipoItem: candidata.tipoItem,
        itemId: candidata.itemId,
        cantidadContada: candidata.cantidadContada,
      });
    }
  }

  return lineas;
}
