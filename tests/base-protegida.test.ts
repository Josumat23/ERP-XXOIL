import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PREFIJO_BASE_PRUEBAS } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Una prueba solo se conecta a su propia base.
//
// El origen de esta guardia: ejecutar `npx tsx --test <archivo>` a mano hereda
// la `DATABASE_URL` del `.env`, y cualquier prueba que importe `@/lib/prisma`
// escribe ahí. Pasó el 2026-09-12 contra `dev.db` —tres filas `Empresa`
// quedaron dentro y el SHA256 del archivo cambió— y el 2026-09-14 contra la
// misma base, con cinco filas de `tareas_programadas`.
//
// El criterio cambió al migrar a PostgreSQL el 2026-09-15, y el cambio importa.
//
// Con SQLite la regla era «la base no puede estar dentro del repositorio»,
// porque las protegidas son archivos que viven ahí. Con una URL de conexión no
// hay ruta que mirar: esa regla sola habría quedado siempre en falso —presente,
// verde, y sin proteger nada—. La regla nueva es al revés y más estricta: bajo
// el runner, la base **tiene que llamarse** `erp_test_…`, que es lo único que
// `run-tests.mjs` crea y destruye.
//
// La regla vieja se conserva porque el módulo de respaldo sigue trabajando con
// archivos, y las dos se comprueban acá.
// ---------------------------------------------------------------------------

/** Corre un archivo de prueba de un solo uso bajo el runner de Node. */
function correrPruebaSuelta(archivo: string, databaseUrl: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "--test", archivo], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl, NODE_TEST_CONTEXT: undefined },
  });
}

const FUENTE_SONDA = [
  'import { test } from "node:test";',
  'import "@/lib/prisma";',
  'test("x", () => {});',
  "",
].join("\n");

async function conSonda<T>(prefijo: string, accion: (sonda: string) => Promise<T>): Promise<T> {
  const directorio = await mkdtemp(join(tmpdir(), prefijo));
  const sonda = join(directorio, "sonda.test.ts");
  await writeFile(sonda, FUENTE_SONDA, "utf8");
  try {
    return await accion(sonda);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
}

test("una prueba suelta no se conecta a la base de desarrollo", async () => {
  // El caso real: alguien corre un archivo a mano y hereda la `DATABASE_URL`
  // del `.env`, que apunta a la base de trabajo con datos de verdad.
  await conSonda("erp-guardia-", async (sonda) => {
    const resultado = correrPruebaSuelta(sonda, "postgresql://postgres@localhost:5433/erp_dev");
    const salida = `${resultado.stdout}${resultado.stderr}`;
    assert.notEqual(resultado.status, 0, "la prueba suelta debería haber fallado");
    assert.match(salida, /no es una base de pruebas/);
    // El mensaje tiene que decir qué hacer, no solo que algo está mal.
    assert.match(salida, /npm test/);
  });
});

test("la negativa no depende de que el servidor esté levantado", async () => {
  // Se comprueba antes de construir el adaptador, así que ni siquiera hace
  // falta que haya un PostgreSQL escuchando: si la guardia fallara, el error
  // sería de conexión y no de nombre, y eso se distingue en el texto.
  await conSonda("erp-guardia-off-", async (sonda) => {
    const resultado = correrPruebaSuelta(sonda, "postgresql://nadie@localhost:59999/produccion");
    const salida = `${resultado.stdout}${resultado.stderr}`;
    assert.notEqual(resultado.status, 0);
    assert.match(salida, /«produccion»/);
    assert.doesNotMatch(salida, /ECONNREFUSED/);
  });
});

test("la base efímera del runner sí pasa", async () => {
  // La guardia tiene que dejar trabajar a la suite. Se usa la base de esta
  // misma corrida: si el prefijo cambiara en un lado y no en el otro, acá se
  // ve.
  const propia = process.env.DATABASE_URL;
  assert.ok(propia, "la suite corre con DATABASE_URL definida");
  await conSonda("erp-guardia-ok-", async (sonda) => {
    const resultado = correrPruebaSuelta(sonda, propia);
    const salida = `${resultado.stdout}${resultado.stderr}`;
    assert.equal(resultado.status, 0, salida);
    assert.doesNotMatch(salida, /no es una base de pruebas/);
  });
});

test("la regla de archivos sigue en pie para SQLite", async () => {
  // El módulo de respaldo sigue abriendo archivos `.db` sueltos, así que la
  // regla vieja no se retiró: una prueba que apunte a un archivo del
  // repositorio se sigue rechazando, y sin crearlo.
  const baseProhibida = "./.guardia-no-deberia-existir.db";
  try {
    await conSonda("erp-guardia-sqlite-", async (sonda) => {
      const resultado = correrPruebaSuelta(sonda, `file:${baseProhibida}`);
      const salida = `${resultado.stdout}${resultado.stderr}`;
      assert.notEqual(resultado.status, 0);
      assert.match(salida, /está dentro del repositorio/);
      assert.match(salida, /run-tests\.mjs/);
      // Y no se creó el archivo: la negativa ocurre antes de abrir nada.
      await assert.rejects(stat(resolve(process.cwd(), baseProhibida)));
    });
  } finally {
    await rm(resolve(process.cwd(), baseProhibida), { force: true });
  }
});

test("fuera de una prueba, la guardia no estorba", () => {
  // El servidor y los scripts trabajan contra la base configurada: es su
  // trabajo. La guardia solo mira cuando el proceso es del runner de pruebas.
  //
  // `NODE_TEST_CONTEXT` se borra a mano porque un hijo lanzado DESDE una
  // prueba la hereda. Esa herencia es deseable —algo que una prueba dispara
  // sigue siendo una prueba— y es justamente lo que hay que anular para
  // representar aquí al servidor, que no lo es.
  //
  // Se apunta a una base que no existe y a un puerto donde no hay nadie:
  // construir el cliente de Prisma no abre la conexión, así que esto no toca
  // ninguna base real y aun así demuestra que la guardia no intervino.
  const { NODE_TEST_CONTEXT, ...heredado } = process.env;
  void NODE_TEST_CONTEXT;
  const entorno = {
    ...heredado,
    DATABASE_URL: "postgresql://nadie@localhost:59999/guardia_fuera_de_prueba",
  };
  const resultado = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", 'import("@/lib/prisma").then(() => console.log("construido"));'],
    { cwd: process.cwd(), encoding: "utf8", env: entorno }
  );
  const salida = `${resultado.stdout}${resultado.stderr}`;
  assert.match(salida, /construido/);
  assert.doesNotMatch(salida, /no es una base de pruebas/);
});

test("el prefijo es el mismo que usa el runner", async () => {
  // Dos constantes con el mismo valor escritas en dos archivos distintas se
  // separan sin que nadie lo note, y el síntoma sería la suite entera
  // negándose a arrancar. `run-tests.mjs` corre con `node` a secas, sin tsx,
  // así que no puede importar el TypeScript: lo que queda es comprobarlo.
  const { readFile } = await import("node:fs/promises");
  const fuente = await readFile(resolve(process.cwd(), "scripts/lib/postgres.mjs"), "utf8");
  assert.match(
    fuente,
    new RegExp(`PREFIJO_BASE_PRUEBAS = "${PREFIJO_BASE_PRUEBAS}"`),
    `scripts/lib/postgres.mjs no declara el prefijo «${PREFIJO_BASE_PRUEBAS}» que exige src/lib/prisma.ts`
  );
});
