const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DECENAS_ESPECIALES: Record<number, string> = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  16: "DIECISEIS",
  17: "DIECISIETE",
  18: "DIECIOCHO",
  19: "DIECINUEVE",
  20: "VEINTE",
};
const DECENAS = [
  "",
  "",
  "VEINTI",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];
const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function convertirDecenas(n: number): string {
  if (n === 0) return "";
  if (n <= 9) return UNIDADES[n];
  if (n in DECENAS_ESPECIALES) return DECENAS_ESPECIALES[n];
  if (n < 30) return `VEINTI${UNIDADES[n - 20]}`;
  const dec = Math.floor(n / 10);
  const uni = n % 10;
  return uni === 0 ? DECENAS[dec] : `${DECENAS[dec]} Y ${UNIDADES[uni]}`;
}

function convertirCentenas(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const cen = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [cen > 0 ? CENTENAS[cen] : "", convertirDecenas(resto)].filter(Boolean);
  return partes.join(" ");
}

function convertirEntero(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const restoMillones = n % 1_000_000;
  const miles = Math.floor(restoMillones / 1000);
  const centenas = restoMillones % 1000;

  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLON" : `${convertirCentenas(millones)} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? "MIL" : `${convertirCentenas(miles)} MIL`);
  }
  if (centenas > 0) partes.push(convertirCentenas(centenas));
  return partes.join(" ");
}

const ETIQUETA_MONEDA: Record<string, string> = { PEN: "SOLES", USD: "DOLARES" };

// Representación impresa peruana estándar: "SON: DIEZ MIL QUINIENTOS Y 00/100 SOLES".
export function numeroALetras(monto: number, moneda = "PEN"): string {
  const negativo = monto < 0;
  const abs = Math.abs(monto);
  const entero = Math.floor(abs);
  const centavos = Math.round((abs - entero) * 100);
  const etiqueta = ETIQUETA_MONEDA[moneda] ?? moneda;

  return `SON: ${negativo ? "MENOS " : ""}${convertirEntero(entero)} Y ${String(centavos).padStart(2, "0")}/100 ${etiqueta}`;
}
