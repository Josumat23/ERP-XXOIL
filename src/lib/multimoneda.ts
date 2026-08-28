function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function validarTipoCambio(moneda: string, tipoCambio: number): boolean {
  return moneda === "PEN" ? tipoCambio === 1 : Number.isFinite(tipoCambio) && tipoCambio > 0;
}

export function convertirAMonedaFuncional(
  monto: number,
  moneda: string,
  tipoCambio: number,
  monedaFuncional = "PEN"
): number {
  if (!Number.isFinite(monto) || monto < 0) throw new Error("El monto es inválido.");
  if (monedaFuncional !== "PEN") {
    throw new Error("La conversión automática está implementada únicamente para moneda funcional PEN.");
  }
  if (!validarTipoCambio(moneda, tipoCambio)) {
    throw new Error("El tipo de cambio es inválido para la moneda del documento.");
  }
  return redondearMoneda(moneda === monedaFuncional ? monto : monto * tipoCambio);
}

export function calcularImportesFuncionales(params: {
  moneda: string;
  tipoCambio: number;
  monedaFuncional?: string;
  subtotal: number;
  igv: number;
  total: number;
}) {
  const monedaFuncional = params.monedaFuncional ?? "PEN";
  return {
    monedaFuncional,
    subtotalFuncional: convertirAMonedaFuncional(params.subtotal, params.moneda, params.tipoCambio, monedaFuncional),
    igvFuncional: convertirAMonedaFuncional(params.igv, params.moneda, params.tipoCambio, monedaFuncional),
    totalFuncional: convertirAMonedaFuncional(params.total, params.moneda, params.tipoCambio, monedaFuncional),
  };
}

export function calcularAplicacionCobro(params: {
  moneda: string;
  montoDocumento: number;
  saldoDocumento: number;
  saldoFuncional: number;
  tipoCambioCobro: number;
}) {
  const { moneda, montoDocumento, saldoDocumento, saldoFuncional, tipoCambioCobro } = params;
  if (!Number.isFinite(montoDocumento) || montoDocumento <= 0 || montoDocumento > saldoDocumento + 1e-9) {
    throw new Error("El monto del cobro es inválido para el saldo del documento.");
  }
  if (!Number.isFinite(saldoDocumento) || saldoDocumento <= 0 || !Number.isFinite(saldoFuncional) || saldoFuncional < 0) {
    throw new Error("El saldo de la factura es inválido.");
  }
  const montoFuncional = convertirAMonedaFuncional(montoDocumento, moneda, tipoCambioCobro);
  const esCancelacion = Math.abs(montoDocumento - saldoDocumento) <= 1e-9;
  const cxcFuncionalAplicada = esCancelacion
    ? redondearMoneda(saldoFuncional)
    : redondearMoneda(saldoFuncional * montoDocumento / saldoDocumento);
  const diferenciaCambio = redondearMoneda(montoFuncional - cxcFuncionalAplicada);
  return {
    montoFuncional,
    cxcFuncionalAplicada,
    diferenciaCambio,
    nuevoSaldoDocumento: redondearMoneda(saldoDocumento - montoDocumento),
    nuevoSaldoFuncional: redondearMoneda(saldoFuncional - cxcFuncionalAplicada),
  };
}