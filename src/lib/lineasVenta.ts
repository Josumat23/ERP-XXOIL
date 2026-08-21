export type LineaVentaNormalizada = {
  presentacionId: string;
  cantidad: number;
  precioUnitario: number;
};

export function normalizarLineasVenta(valor: unknown): LineaVentaNormalizada[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaVentaNormalizada[] = [];
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("presentacionId" in candidata) ||
      !("cantidad" in candidata) ||
      !("precioUnitario" in candidata) ||
      typeof candidata.presentacionId !== "string" ||
      typeof candidata.cantidad !== "number" ||
      typeof candidata.precioUnitario !== "number"
    ) {
      continue;
    }

    if (
      candidata.presentacionId &&
      Number.isInteger(candidata.cantidad) &&
      candidata.cantidad > 0 &&
      Number.isFinite(candidata.precioUnitario) &&
      candidata.precioUnitario >= 0
    ) {
      lineas.push({
        presentacionId: candidata.presentacionId,
        cantidad: candidata.cantidad,
        precioUnitario: candidata.precioUnitario,
      });
    }
  }

  return lineas;
}
