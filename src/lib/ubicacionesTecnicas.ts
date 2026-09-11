// Jerarquía de ubicaciones técnicas de mantenimiento (planta → línea →
// estación). Mismo patrón puro que jerarquiaCentrosCosto: las funciones
// reciben el listado completo de nodos y no tocan la base, para poder
// probarlas sin infraestructura y reutilizarlas desde página y acción.

export type NodoUbicacionTecnica = {
  id: string;
  parentId: string | null;
};

export type NodoUbicacionConNombre = NodoUbicacionTecnica & {
  codigo: string;
  nombre: string;
};

/** El nodo indicado más todos sus descendientes. Tolera datos con ciclos. */
export function idsSubarbolUbicacion(
  ubicacionId: string,
  ubicaciones: readonly NodoUbicacionTecnica[],
): string[] {
  const hijosPorPadre = new Map<string, string[]>();
  for (const ubicacion of ubicaciones) {
    if (!ubicacion.parentId) continue;
    const hijos = hijosPorPadre.get(ubicacion.parentId) ?? [];
    hijos.push(ubicacion.id);
    hijosPorPadre.set(ubicacion.parentId, hijos);
  }

  const resultado: string[] = [];
  const pendientes = [ubicacionId];
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

/** Colgar `ubicacionId` de `parentId` cerraría un ciclo. */
export function creariaCicloUbicacion(
  ubicacionId: string,
  parentId: string | null,
  ubicaciones: readonly NodoUbicacionTecnica[],
): boolean {
  if (!parentId) return false;
  if (parentId === ubicacionId) return true;
  return idsSubarbolUbicacion(ubicacionId, ubicaciones).includes(parentId);
}

/**
 * Cadena de ancestros desde la raíz hasta el nodo, ambos incluidos. Devuelve
 * `[]` si el id no existe; corta si los datos traen un ciclo, para no colgar
 * la página que la renderiza.
 */
export function rutaUbicacion<T extends NodoUbicacionTecnica>(
  ubicacionId: string,
  ubicaciones: readonly T[],
): T[] {
  const porId = new Map(ubicaciones.map((u) => [u.id, u]));
  const ruta: T[] = [];
  const visitados = new Set<string>();
  let actual = porId.get(ubicacionId);
  while (actual && !visitados.has(actual.id)) {
    visitados.add(actual.id);
    ruta.unshift(actual);
    actual = actual.parentId ? porId.get(actual.parentId) : undefined;
  }
  return ruta;
}

/** Profundidad del nodo: 0 para una raíz. */
export function nivelUbicacion(
  ubicacionId: string,
  ubicaciones: readonly NodoUbicacionTecnica[],
): number {
  const ruta = rutaUbicacion(ubicacionId, ubicaciones);
  return ruta.length === 0 ? 0 : ruta.length - 1;
}

/** Ruta legible tipo "PLANTA-1 › LINEA-A › ENV-02". */
export function etiquetaRutaUbicacion(
  ubicacionId: string,
  ubicaciones: readonly NodoUbicacionConNombre[],
): string {
  return rutaUbicacion(ubicacionId, ubicaciones)
    .map((u) => u.codigo)
    .join(" › ");
}

/**
 * Orden de árbol para listados: cada raíz seguida de sus descendientes, con
 * los hermanos por código. Los nodos huérfanos (padre inexistente o ciclo)
 * se emiten al final para que nunca desaparezcan de la pantalla.
 */
export function ordenarArbolUbicaciones<T extends NodoUbicacionConNombre>(
  ubicaciones: readonly T[],
): { ubicacion: T; nivel: number }[] {
  const porId = new Map(ubicaciones.map((u) => [u.id, u]));
  const hijosPorPadre = new Map<string | null, T[]>();
  for (const ubicacion of ubicaciones) {
    const clave = ubicacion.parentId && porId.has(ubicacion.parentId) ? ubicacion.parentId : null;
    const hijos = hijosPorPadre.get(clave) ?? [];
    hijos.push(ubicacion);
    hijosPorPadre.set(clave, hijos);
  }
  for (const hijos of hijosPorPadre.values()) {
    hijos.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  const resultado: { ubicacion: T; nivel: number }[] = [];
  const visitados = new Set<string>();
  function recorrer(padre: string | null, nivel: number) {
    for (const hijo of hijosPorPadre.get(padre) ?? []) {
      if (visitados.has(hijo.id)) continue;
      visitados.add(hijo.id);
      resultado.push({ ubicacion: hijo, nivel });
      recorrer(hijo.id, nivel + 1);
    }
  }
  recorrer(null, 0);

  for (const ubicacion of ubicaciones) {
    if (!visitados.has(ubicacion.id)) resultado.push({ ubicacion, nivel: 0 });
  }
  return resultado;
}
