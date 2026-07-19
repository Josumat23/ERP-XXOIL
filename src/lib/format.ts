type Numerico = number | string | { toNumber(): number };

function aNumero(valor: Numerico): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") return Number(valor);
  return valor.toNumber();
}

export function formatMoneda(valor: Numerico, moneda = "PEN"): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
  }).format(aNumero(valor));
}

export function formatNumero(valor: Numerico, decimales = 2): string {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(aNumero(valor));
}

export function formatFecha(valor: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(valor);
}
