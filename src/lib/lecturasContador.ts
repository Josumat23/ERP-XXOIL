export function normalizarLecturaContador(valor: string): number | null | undefined {
  if (!valor) return null;

  const lectura = Number(valor);
  if (!Number.isFinite(lectura) || lectura < 0) return undefined;
  return lectura;
}
