const PREFIJO_FORMULA = /^[=+\-@\t\r]/;

export function escaparCeldaCsv(valor: string): string {
  const seguro = PREFIJO_FORMULA.test(valor) ? "'" + valor : valor;
  if (seguro.includes(",") || seguro.includes('"') || seguro.includes("\n") || seguro.includes("\r")) {
    return '"' + seguro.replace(/"/g, '""') + '"';
  }
  return seguro;
}