// Slotting multi-nivel: pasillo → rack → nivel → posición.
//
// Mismo patrón puro que `ubicacionesTecnicas` y `jerarquiaCentrosCosto`: las
// funciones reciben el listado completo de zonas y no tocan la base, para
// probarlas sin infraestructura y reutilizarlas desde página y acción.
//
// La jerarquía es una capa de ORGANIZACIÓN sobre `SaldoZona`, que sigue
// guardando la cantidad en la zona concreta donde está el stock. Nada obliga a
// que el stock viva solo en las hojas: las zonas que ya existían quedaron como
// raíces con su stock, y romper eso habría exigido migrar saldos. Lo que sí
// hace falta es no esconderlo, y por eso el acumulado distingue siempre entre
// lo que hay **en** una zona y lo que hay **bajo** ella.

export type NodoZona = {
  id: string;
  parentId: string | null;
};

export type NodoZonaConCodigo = NodoZona & {
  codigo: string;
  nombre: string | null;
};

/** La zona indicada más todas sus descendientes. Tolera datos con ciclos. */
export function idsSubarbolZona(zonaId: string, zonas: readonly NodoZona[]): string[] {
  const hijosPorPadre = new Map<string, string[]>();
  for (const zona of zonas) {
    if (!zona.parentId) continue;
    const hijos = hijosPorPadre.get(zona.parentId) ?? [];
    hijos.push(zona.id);
    hijosPorPadre.set(zona.parentId, hijos);
  }

  const resultado: string[] = [];
  const pendientes = [zonaId];
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

/** Colgar `zonaId` de `parentId` cerraría un ciclo. */
export function creariaCicloZona(
  zonaId: string,
  parentId: string | null,
  zonas: readonly NodoZona[]
): boolean {
  if (!parentId) return false;
  if (parentId === zonaId) return true;
  return idsSubarbolZona(zonaId, zonas).includes(parentId);
}

/**
 * Cadena de ancestros desde la raíz hasta la zona, ambas incluidas. Devuelve
 * `[]` si el id no existe; corta ante un ciclo para no colgar la página.
 */
export function rutaZona<T extends NodoZona>(zonaId: string, zonas: readonly T[]): T[] {
  const porId = new Map(zonas.map((z) => [z.id, z]));
  const ruta: T[] = [];
  const visitados = new Set<string>();
  let actual = porId.get(zonaId);
  while (actual && !visitados.has(actual.id)) {
    visitados.add(actual.id);
    ruta.unshift(actual);
    actual = actual.parentId ? porId.get(actual.parentId) : undefined;
  }
  return ruta;
}

/** Ruta legible tipo "PASILLO-A › RACK-2 › N3". */
export function etiquetaRutaZona(zonaId: string, zonas: readonly NodoZonaConCodigo[]): string {
  return rutaZona(zonaId, zonas)
    .map((z) => z.codigo)
    .join(" › ");
}

/** Profundidad de la zona: 0 para una raíz. */
export function nivelZona(zonaId: string, zonas: readonly NodoZona[]): number {
  const ruta = rutaZona(zonaId, zonas);
  return ruta.length === 0 ? 0 : ruta.length - 1;
}

/**
 * Orden de árbol para listados: cada raíz seguida de sus descendientes, con
 * los hermanos por código. Las zonas huérfanas (padre inexistente o ciclo) se
 * emiten al final para que nunca desaparezcan de la pantalla.
 */
export function ordenarArbolZonas<T extends NodoZonaConCodigo>(
  zonas: readonly T[]
): { zona: T; nivel: number }[] {
  const porId = new Map(zonas.map((z) => [z.id, z]));
  const hijosPorPadre = new Map<string | null, T[]>();
  for (const zona of zonas) {
    const clave = zona.parentId && porId.has(zona.parentId) ? zona.parentId : null;
    const hijos = hijosPorPadre.get(clave) ?? [];
    hijos.push(zona);
    hijosPorPadre.set(clave, hijos);
  }
  for (const hijos of hijosPorPadre.values()) {
    hijos.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  const resultado: { zona: T; nivel: number }[] = [];
  const visitados = new Set<string>();
  function recorrer(padre: string | null, nivel: number) {
    for (const hijo of hijosPorPadre.get(padre) ?? []) {
      if (visitados.has(hijo.id)) continue;
      visitados.add(hijo.id);
      resultado.push({ zona: hijo, nivel });
      recorrer(hijo.id, nivel + 1);
    }
  }
  recorrer(null, 0);

  for (const zona of zonas) {
    if (!visitados.has(zona.id)) resultado.push({ zona, nivel: 0 });
  }
  return resultado;
}

export type OcupacionZona = {
  /** Ítems distintos con saldo en la zona misma. */
  propia: number;
  /** Ítems distintos con saldo en la zona y en todo lo que cuelga de ella. */
  subarbol: number;
};

/**
 * Cuántos ítems distintos ocupan cada zona, contando por separado lo propio y
 * lo del subárbol.
 *
 * Se cuentan **ítems**, no unidades: sumar unidades de aceite en litros con
 * baldes en unidades daría un número sin significado. Lo que el encargado
 * necesita saber al mirar el árbol es qué está ocupado y qué está libre.
 *
 * Los dos números se muestran siempre juntos: un pasillo que dice "12" sin
 * aclarar que once están en sus racks y uno suelto en el piso del pasillo
 * esconde justo el dato que hace falta para ordenar el almacén.
 */
export function ocupacionPorZona(
  zonas: readonly NodoZona[],
  itemsPorZona: ReadonlyMap<string, number>
): Map<string, OcupacionZona> {
  const resultado = new Map<string, OcupacionZona>();
  for (const zona of zonas) {
    const subarbol = idsSubarbolZona(zona.id, zonas).reduce(
      (acc, id) => acc + (itemsPorZona.get(id) ?? 0),
      0
    );
    resultado.set(zona.id, { propia: itemsPorZona.get(zona.id) ?? 0, subarbol });
  }
  return resultado;
}
