// El filtro de texto de las búsquedas de pantalla, en un solo lugar.
//
// Existe por una razón concreta y medida: **SQLite y PostgreSQL no buscan
// igual**.
//
// En SQLite, `LIKE` es insensible a mayúsculas para ASCII. En PostgreSQL es
// sensible, y Prisma traduce `contains` a `LIKE` salvo que se le pida
// `mode: "insensitive"`, que genera `ILIKE`. Medido contra los dos motores:
//
//   patrón          vs texto                  SQLite  LIKE  ILIKE
//   %ferreteria%    FERRETERIA SAN MARTIN       sí     no    sí
//   %ferreteria%    Ferretería San Martín       no     no    no
//   %ferretería%    Ferretería San Martín       sí     no    sí
//
// Es decir: `ILIKE` reproduce exactamente lo que SQLite hacía. Las tildes se
// comportan igual en los dos motores —ninguno las pliega— así que no eran un
// riesgo; la diferencia de mayúsculas sí.
//
// Sin este ayudante, la migración del 2026-09-15 habría dejado de encontrar
// «FERRETERIA SAN MARTIN» al buscar «ferreteria» en las 32 pantallas que tienen
// buscador. Sin un error y sin una línea de log: los listados devolverían menos
// filas, y el problema aparecería semanas después como «el buscador no anda
// bien».
//
// El 2026-09-14 se reunieron acá los 63 usos, con `mode` todavía imposible
// —no existe en los tipos que Prisma genera para SQLite: no compilaba—. El
// 2026-09-15, con el motor ya cambiado, el arreglo fue **una línea en un
// archivo** en vez de 63 ediciones repartidas en 32 pantallas. Una guardia
// impide que vuelvan a dispersarse.

/**
 * Coincidencia parcial de texto, sin distinguir mayúsculas, para un filtro de
 * Prisma.
 *
 * Se usa como `{ razonSocial: contiene(q) }`.
 */
export function contiene(texto: string) {
  return { contains: texto, mode: "insensitive" as const };
}
