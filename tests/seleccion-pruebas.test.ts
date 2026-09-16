import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { avisoParcial, errorDeFiltroVacio, seleccionarPruebas } from "../scripts/lib/pruebas.mjs";

// ---------------------------------------------------------------------------
// `npm test -- <filtro>` corre solo los archivos que coincidan.
//
// Existe por una cuenta concreta. Los días 15 y 16 de septiembre de 2026 la
// suite completa se corrió unas diez veces —~8 minutos cada una— y la mayoría
// fue para comprobar arreglos de dos líneas: un mensaje de error, un número mal
// contado. Sin filtro, verificar un cambio de dos líneas cuesta lo mismo que
// verificar el sistema entero, así que o se paga de más o se verifica de menos.
//
// Medido después del cambio: `npm test -- respaldo` tarda 38 segundos contra
// los ~8 minutos de la suite completa.
//
// Lo que se prueba acá no es la comodidad sino las dos formas en que un filtro
// puede hacer daño: correr cero pruebas en verde, y parecerse a una corrida
// completa.
// ---------------------------------------------------------------------------

const ARCHIVOS = [
  "respaldo-postgres.test.ts",
  "respaldo.test.ts",
  "critical-flows.test.ts",
  "migracion-postgresql.test.ts",
];

test("sin filtro corre todo", () => {
  const seleccion = seleccionarPruebas(ARCHIVOS, []);
  assert.deepEqual(seleccion.archivos, ARCHIVOS);
  assert.equal(seleccion.parcial, false);
  // Y no se avisa de nada: la corrida completa es lo normal, no la excepción.
  assert.equal(errorDeFiltroVacio(seleccion, ARCHIVOS.length), null);
});

test("el filtro compara contra el nombre del archivo", () => {
  const seleccion = seleccionarPruebas(ARCHIVOS, ["respaldo"]);
  assert.deepEqual(seleccion.archivos, ["respaldo-postgres.test.ts", "respaldo.test.ts"]);
  assert.equal(seleccion.parcial, true);
});

test("varios filtros suman, no intersectan", () => {
  // Quien escribe dos nombres quiere los dos, no los archivos que contengan
  // ambos —que serían ninguno— y descubrir eso costaría otra corrida.
  const seleccion = seleccionarPruebas(ARCHIVOS, ["critical", "migracion"]);
  assert.deepEqual(seleccion.archivos, ["critical-flows.test.ts", "migracion-postgresql.test.ts"]);
});

test("un filtro que no encuentra nada es un ERROR, no una corrida vacía", () => {
  // Ésta es la razón por la que el filtro se puede tener sin que sea peligroso.
  // Cero pruebas en verde es exactamente la forma de creer que algo está
  // probado cuando no lo está — y un error de tipeo alcanza para producirlo.
  const seleccion = seleccionarPruebas(ARCHIVOS, ["respaldoo"]);
  assert.deepEqual(seleccion.archivos, []);
  const error = errorDeFiltroVacio(seleccion, ARCHIVOS.length);
  assert.ok(error, "un filtro sin coincidencias tiene que producir un error");
  assert.match(error, /respaldoo/, "el error tiene que decir qué filtro falló");
  assert.match(error, /No se corrió nada/);
});

test("una corrida completa nunca produce ese error", () => {
  // La guardia anterior no puede volverse una molestia: sin filtro no hay nada
  // que pueda quedar vacío.
  assert.equal(errorDeFiltroVacio(seleccionarPruebas([], []), 0), null);
});

test("una corrida filtrada se anuncia como parcial y dice cuántos archivos", () => {
  // Una corrida filtrada en verde NO autoriza a publicar nada. El aviso sale al
  // empezar y al terminar, porque después de cientos de líneas de salida lo que
  // queda a la vista es lo último.
  const aviso = avisoParcial(seleccionarPruebas(ARCHIVOS, ["respaldo"]), ARCHIVOS.length);
  assert.match(aviso, /PARCIAL/);
  assert.match(aviso, /2 de 4 archivos/);
  assert.match(aviso, /NO reemplaza a `npm test`/);
});

test("las banderas de node no se confunden con filtros", () => {
  // `npm test -- --watch` no debe interpretarse como «corré los archivos que
  // contengan --watch», que no es ninguno y abortaría con el error de arriba.
  const seleccion = seleccionarPruebas(ARCHIVOS, ["--algo", ""]);
  assert.deepEqual(seleccion.archivos, ARCHIVOS);
  assert.equal(seleccion.parcial, false);
});

test("el runner usa estas funciones en vez de repetir la lógica", async () => {
  // Si el runner volviera a filtrar por su cuenta, estas pruebas seguirían
  // pasando mientras el comando real hace otra cosa.
  const fuente = await readFile(resolve(process.cwd(), "scripts/run-tests.mjs"), "utf8");
  assert.match(fuente, /seleccionarPruebas\(/);
  assert.match(fuente, /errorDeFiltroVacio\(/);
  assert.match(fuente, /avisoParcial\(/);
  // Y el aviso se emite dos veces: al empezar y al terminar.
  assert.equal(
    fuente.split("${PARCIAL}").length - 1,
    2,
    "el aviso de corrida parcial tiene que salir al empezar y al terminar"
  );
});

test("el filtro se compara contra los archivos que de verdad existen", async () => {
  // Una guardia sobre una lista inventada no prueba que el filtro sirva acá.
  const reales = (await readdir(resolve(process.cwd(), "tests"))).filter((n) =>
    n.endsWith(".test.ts")
  );
  assert.ok(reales.length > 40, `solo ${reales.length} archivos de prueba`);
  const seleccion = seleccionarPruebas(reales, ["respaldo"]);
  assert.ok(
    seleccion.archivos.length >= 2 && seleccion.archivos.length < reales.length,
    `«respaldo» seleccionó ${seleccion.archivos.length} de ${reales.length}`
  );
});
