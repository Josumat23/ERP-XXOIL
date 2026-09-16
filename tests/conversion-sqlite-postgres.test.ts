import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  convertirParaPostgres,
  normalizarDePostgres,
  normalizarDeSqlite,
} from "../scripts/lib/conversion.mjs";

// ---------------------------------------------------------------------------
// Traer datos de SQLite a PostgreSQL: las tres diferencias que no fallan.
//
// El 2026-09-16 se movieron las 2.677 filas que quedaron en `local.db` cuando
// el proyecto cambió de motor. Lo que hace peligrosa esa operación no es lo que
// falla —eso se ve— sino lo que sale bien y queda mal.
//
// Estas pruebas fijan las tres conversiones, y en particular la de fechas: está
// medida contra los datos reales, no supuesta.
// ---------------------------------------------------------------------------

test("los booleanos de SQLite son 0 y 1, no false y true", () => {
  assert.equal(convertirParaPostgres(0, "boolean"), false);
  assert.equal(convertirParaPostgres(1, "boolean"), true);
  assert.equal(convertirParaPostgres(null, "boolean"), null);
  // Sin la conversión, PostgreSQL recibiría el número 0 — que es `false` en
  // algunos drivers y un error de tipo en otros. Ninguna de las dos es lo que
  // se quiere, y la primera es la peligrosa.
});

test("los decimales viajan como texto, no como número de JS", () => {
  // Un importe que pasa por un `number` de JS puede volver distinto. Mandarlo
  // como texto deja que PostgreSQL lo interprete con su propio `numeric`.
  assert.equal(convertirParaPostgres(29.5, "numeric"), "29.5");
  assert.equal(convertirParaPostgres(0, "numeric"), "0");
  assert.equal(typeof convertirParaPostgres(44.25, "numeric"), "string");
});

test("una fecha se escribe en UTC explícito, no como Date", () => {
  // ESTA es la que importa. Las columnas son `timestamp without time zone` y
  // el driver serializa un `Date` en la zona de la máquina: en Perú (UTC−5)
  // eso corre la fecha cinco horas.
  const deSqlite = "2026-09-14T14:19:36.992+00:00";
  const escrito = convertirParaPostgres(deSqlite, "timestamp without time zone");

  assert.equal(typeof escrito, "string", "un Date acá es el defecto de las cinco horas");
  assert.equal(escrito, "2026-09-14 14:19:36.992");
  // Sin zona horaria dentro: la columna no la guarda, y dejarla haría que
  // PostgreSQL la convirtiera otra vez.
  assert.doesNotMatch(escrito as string, /[Z+]|[+-]\d\d:\d\d$/);
});

test("ida y vuelta: la fecha que llega es la misma que salió", () => {
  // La prueba de verdad no es cómo se escribe sino si vuelve igual, porque eso
  // es lo que ve la aplicación.
  for (const original of [
    "2026-09-14T14:19:36.992+00:00",
    "2025-10-08T15:00:00.000+00:00",
    "2026-01-01T00:00:00.000+00:00",
    "2026-12-31T23:59:59.999+00:00",
  ]) {
    const escrito = convertirParaPostgres(original, "timestamp without time zone") as string;
    assert.equal(
      normalizarDePostgres(escrito, "timestamp without time zone"),
      normalizarDeSqlite(original, "timestamp without time zone"),
      `la fecha ${original} no vuelve igual`
    );
  }
});

test("la comparación detecta un corrimiento de zona horaria", () => {
  // Si la verificación del migrador no viera este caso, no serviría de nada.
  // Medido: el defecto real producía exactamente 18.000.000 ms de diferencia.
  const original = "2026-09-14T14:19:36.992+00:00";
  const correcto = convertirParaPostgres(original, "timestamp") as string;
  const corrido = "2026-09-14 09:19:36.992"; // lo que habría escrito un Date en UTC−5

  const esperado = normalizarDeSqlite(original, "timestamp");
  assert.equal(normalizarDePostgres(correcto, "timestamp"), esperado);
  assert.notEqual(normalizarDePostgres(corrido, "timestamp"), esperado);
  assert.equal(
    (esperado as number) - (normalizarDePostgres(corrido, "timestamp") as number),
    5 * 60 * 60 * 1000
  );
});

test("una fecha ilegible falla en vez de convertirse en otra", () => {
  // `new Date("cualquier cosa")` no lanza: devuelve Invalid Date, y de ahí
  // saldría un `null` o un 1970 sin que nadie se entere.
  assert.throws(() => convertirParaPostgres("no es una fecha", "timestamp"), /Fecha ilegible/);
});

test("el texto y los enteros pasan tal cual", () => {
  // Los enums son texto en los dos motores y PostgreSQL los valida solo.
  assert.equal(convertirParaPostgres("ACTIVO", "USER-DEFINED"), "ACTIVO");
  assert.equal(convertirParaPostgres("Lubricentro El Rápido E.I.R.L.", "text"), "Lubricentro El Rápido E.I.R.L.");
  assert.equal(convertirParaPostgres(42, "integer"), 42);
  assert.equal(convertirParaPostgres(null, "text"), null);
});

test("el migrador usa estas funciones en vez de repetirlas", async () => {
  // Si volviera a convertir por su cuenta, estas pruebas seguirían pasando
  // mientras el script real hace otra cosa.
  const fuente = await readFile(resolve(process.cwd(), "scripts/migrar-datos.mjs"), "utf8");
  assert.match(fuente, /convertirParaPostgres/);
  assert.match(fuente, /normalizarDePostgres/);
  assert.match(fuente, /normalizarDeSqlite/);
  // Y sigue leyendo los timestamps como texto: sin esto la comparación
  // reinterpretaría las fechas en la zona de la máquina y no vería nada.
  assert.match(fuente.replace(/^\s*\/\/.*$/gm, ""), /setTypeParser\(1114/);
});
