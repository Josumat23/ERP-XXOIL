export const TIPOS_COMPROBANTE_RECEPCION = ["01", "03", "04", "91"] as const;
export const DIAS_CREDITO_RECEPCION = [0, 15, 30] as const;

export type LineaRecepcionCompra = {
  detalleId: string;
  cantidad: number;
  costoUnitario: number;
  numeroLoteProveedor?: string;
};

export function esTipoComprobanteRecepcionValido(valor: string): boolean {
  return TIPOS_COMPROBANTE_RECEPCION.some((permitido) => permitido === valor);
}

export function sonDiasCreditoRecepcionValidos(valor: number): boolean {
  return Number.isInteger(valor) && DIAS_CREDITO_RECEPCION.some((permitido) => permitido === valor);
}

export function normalizarLineasRecepcionCompra(valor: unknown): LineaRecepcionCompra[] | null {
  if (!Array.isArray(valor)) return null;

  const lineas: LineaRecepcionCompra[] = [];
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("detalleId" in candidata) ||
      !("cantidad" in candidata) ||
      typeof candidata.detalleId !== "string" ||
      typeof candidata.cantidad !== "number"
    ) {
      continue;
    }

    const costoUnitario =
      "costoUnitario" in candidata && typeof candidata.costoUnitario === "number"
        ? candidata.costoUnitario
        : Number.NaN;
    const numeroLoteProveedor =
      "numeroLoteProveedor" in candidata && typeof candidata.numeroLoteProveedor === "string"
        ? candidata.numeroLoteProveedor
        : undefined;

    if (candidata.detalleId && Number.isFinite(candidata.cantidad) && candidata.cantidad > 0) {
      lineas.push({
        detalleId: candidata.detalleId,
        cantidad: candidata.cantidad,
        costoUnitario,
        numeroLoteProveedor,
      });
    }
  }

  return lineas;
}
