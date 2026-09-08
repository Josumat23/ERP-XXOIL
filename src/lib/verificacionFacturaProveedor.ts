export const TOLERANCIA_PRECIO_FACTURA = 0.05;

export function evaluarVerificacionFactura(maxVariacionFraccion: number) {
  if (!Number.isFinite(maxVariacionFraccion) || maxVariacionFraccion < 0) throw new Error("La variación de factura es inválida.");
  const bloqueada = maxVariacionFraccion > TOLERANCIA_PRECIO_FACTURA;
  return {
    estadoVerificacion: bloqueada ? "BLOQUEADA" as const : "COINCIDE" as const,
    discrepanciaPrecioPct: bloqueada ? maxVariacionFraccion * 100 : null,
  };
}
