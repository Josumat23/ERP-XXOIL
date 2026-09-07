export type NodoCentroCosto = { id: string; parentId: string | null };

export function idsSubarbolCentroCosto(
  centroId: string,
  centros: readonly NodoCentroCosto[],
): string[] {
  const hijosPorPadre = new Map<string, string[]>();
  for (const centro of centros) {
    if (!centro.parentId) continue;
    const hijos = hijosPorPadre.get(centro.parentId) ?? [];
    hijos.push(centro.id);
    hijosPorPadre.set(centro.parentId, hijos);
  }

  const resultado: string[] = [];
  const pendientes = [centroId];
  const visitados = new Set<string>();
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (!actual || visitados.has(actual)) continue;
    visitados.add(actual);
    resultado.push(actual);
    pendientes.push(...(hijosPorPadre.get(actual) ?? []));
  }
  return resultado;
}

export function creariaCicloCentroCosto(
  centroId: string,
  parentId: string | null,
  centros: readonly NodoCentroCosto[],
): boolean {
  if (!parentId) return false;
  return idsSubarbolCentroCosto(centroId, centros).includes(parentId);
}

export function sumarSubarbolCentroCosto(
  centroId: string,
  centros: readonly NodoCentroCosto[],
  importes: ReadonlyMap<string, number>,
): number {
  return idsSubarbolCentroCosto(centroId, centros)
    .reduce((total, id) => total + (importes.get(id) ?? 0), 0);
}
