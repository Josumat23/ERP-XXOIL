export type LineaFacturaParcial = {
  cantidad: number;
  precioUnitario: number;
};

function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularSaldoFacturable(
  cantidadPedida: number,
  cantidadesFacturadas: readonly number[]
): number {
  return cantidadPedida - cantidadesFacturadas.reduce((total, cantidad) => total + cantidad, 0);
}

export function calcularTotalesFacturaParcial(
  lineas: readonly LineaFacturaParcial[],
  tasaIgv: number
): { subtotal: number; igv: number; total: number } {
  const subtotal = redondearMoneda(
    lineas.reduce((total, linea) => total + linea.precioUnitario * linea.cantidad, 0)
  );
  const igv = redondearMoneda((subtotal * tasaIgv) / 100);
  return { subtotal, igv, total: redondearMoneda(subtotal + igv) };
}
