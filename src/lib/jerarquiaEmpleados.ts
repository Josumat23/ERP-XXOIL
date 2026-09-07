export type RelacionJerarquica = { id: string; jefeDirectoId: string | null };

export function creariaCicloJerarquico(
  empleadoId: string,
  jefeDirectoId: string | null,
  relaciones: RelacionJerarquica[]
): boolean {
  if (!jefeDirectoId) return false;
  if (empleadoId === jefeDirectoId) return true;

  const jefePorEmpleado = new Map(relaciones.map((relacion) => [relacion.id, relacion.jefeDirectoId]));
  const visitados = new Set<string>();
  let actual: string | null = jefeDirectoId;

  while (actual) {
    if (actual === empleadoId) return true;
    if (visitados.has(actual)) return true;
    visitados.add(actual);
    actual = jefePorEmpleado.get(actual) ?? null;
  }

  return false;
}
