import "server-only";

import { prisma } from "@/lib/prisma";
import type { ArbolUbigeos } from "@/lib/ubigeos";

let cache: ArbolUbigeos | null = null;

/**
 * Arma el catálogo agrupado que consumen los selectores en cascada.
 *
 * Es una tabla de referencia: se siembra una vez y no cambia mientras corre el
 * proceso, así que se construye una sola vez por proceso.
 *
 * Si la tabla está vacía devuelve un árbol vacío —el selector lo dice en
 * pantalla en vez de quedar mudo— y **no** se cachea: sembrar los ubigeos
 * después debe surtir efecto sin reiniciar el servidor.
 */
export async function arbolUbigeos(): Promise<ArbolUbigeos> {
  if (cache) return cache;

  const filas = await prisma.ubigeo.findMany({
    select: { id: true, departamento: true, provincia: true, distrito: true },
    orderBy: [{ departamento: "asc" }, { provincia: "asc" }, { distrito: "asc" }],
  });

  const arbol: ArbolUbigeos = {};
  for (const fila of filas) {
    const provincias = (arbol[fila.departamento] ??= {});
    (provincias[fila.provincia] ??= []).push([fila.id, fila.distrito]);
  }

  if (filas.length > 0) cache = arbol;
  return arbol;
}
