// Cómo se traduce un valor de SQLite a PostgreSQL, y cómo se comparan después.
//
// Vive aparte y son funciones puras por un motivo concreto: las tres
// diferencias entre los dos motores **no fallan al escribir**. Salen bien y
// quedan mal, así que la única forma de saber que están bien es probarlas.
//
// La peor de las tres, medida el 2026-09-16 sobre los datos reales: las
// columnas de fecha son `timestamp without time zone` y el driver de
// PostgreSQL serializa un `Date` de JS **en la zona horaria de la máquina**.
// En Perú (UTC−5) eso corría las 761 fechas del sistema exactamente cinco
// horas —18.000.000 ms— sin un error y sin un aviso: facturas emitidas cinco
// horas antes, asientos contables cayendo en otro día.

/**
 * El valor de SQLite listo para escribirse en una columna de PostgreSQL.
 *
 * `tipo` es el `data_type` que declara `information_schema.columns`, o sea el
 * del destino: es el destino el que manda, no lo que el origen haya guardado.
 */
export function convertirParaPostgres(valor, tipo) {
  if (valor === null || valor === undefined) return null;
  // SQLite no tiene booleanos: son 0 y 1.
  if (tipo === "boolean") return valor !== 0;
  // Los decimales viajan como texto para que el paso por un número de JS no
  // los cambie.
  if (tipo === "numeric") return String(valor);
  if (tipo.startsWith("timestamp")) {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      throw new Error(`Fecha ilegible: ${JSON.stringify(valor)}`);
    }
    // Hora UTC explícita. Pasar el `Date` acá es el defecto de las cinco horas.
    return fecha.toISOString().replace("T", " ").replace("Z", "");
  }
  return valor;
}

/** El valor tal como vuelve de PostgreSQL, en forma comparable. */
export function normalizarDePostgres(valor, tipo) {
  if (valor === null || valor === undefined) return null;
  if (tipo === "boolean") return valor === true;
  if (tipo === "numeric") return Number(valor);
  // Llega como texto sin zona (ver el `setTypeParser` del migrador) y se lee
  // como UTC, que es como lo escribió `convertirParaPostgres`.
  if (tipo.startsWith("timestamp")) return new Date(`${valor}Z`).getTime();
  return valor;
}

/** El mismo valor en el origen, en la misma forma comparable. */
export function normalizarDeSqlite(valor, tipo) {
  if (valor === null || valor === undefined) return null;
  if (tipo === "boolean") return valor !== 0;
  if (tipo === "numeric") return Number(valor);
  if (tipo.startsWith("timestamp")) return new Date(valor).getTime();
  return valor;
}
