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
// Es decir: `ILIKE` reproduce exactamente lo que SQLite hace hoy. Las tildes
// se comportan igual en los dos motores —ninguno las pliega— así que no son
// un riesgo; la diferencia de mayúsculas sí.
//
// Sin este cambio, el día de la migración buscar «ferreteria» dejaría de
// encontrar «FERRETERIA SAN MARTIN» en las 32 pantallas que tienen buscador.
// Sin un error y sin una línea de log: los listados devolverían menos filas, y
// el problema aparecería semanas después como «el buscador no anda bien».
//
// `mode` **no existe** en los tipos que Prisma genera para SQLite, así que no
// se puede agregar todavía: no compila. Por eso el cambio de hoy es reunir los
// 63 usos acá. El día de la migración es **una línea en un archivo** en vez de
// 63 ediciones repartidas en 32 pantallas — y una guardia impide que vuelvan a
// dispersarse.

/**
 * Coincidencia parcial de texto para un filtro de Prisma.
 *
 * Se usa como `{ razonSocial: contiene(q) }`.
 *
 * Al migrar a PostgreSQL, acá se agrega `mode: "insensitive"` y todas las
 * búsquedas del sistema conservan el comportamiento que tienen hoy.
 */
export function contiene(texto: string) {
  return { contains: texto };
}
