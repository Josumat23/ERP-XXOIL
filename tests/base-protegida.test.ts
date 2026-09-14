import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// La suite no puede tocar las bases del repositorio.
//
// `dev.db` y sus respaldos están protegidos. El runner apunta siempre a una
// base efímera del temporal, pero ejecutar `npx tsx --test <archivo>` a mano
// hereda la `DATABASE_URL` del `.env` — que es `dev.db`— y cualquier prueba
// que importe `@/lib/prisma` escribe ahí. Pasó el 2026-09-12: tres filas
// `Empresa` quedaron dentro y el SHA256 del archivo cambió.
//
// No alcanza con que la prueba limpie lo que creó: SQLite reutiliza páginas,
// así que insertar y borrar deja otros bytes y el hash ya no vuelve. Por eso
// `@/lib/prisma` se niega a **conectarse**, no a escribir.
// ---------------------------------------------------------------------------

/** Corre un archivo de prueba de un solo uso bajo el runner de Node. */
function correrPruebaSuelta(archivo: string, databaseUrl: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "--test", archivo], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl, NODE_TEST_CONTEXT: undefined },
  });
}

test("una prueba suelta no se conecta a una base del repositorio", async () => {
  // Se apunta a un nombre que NO existe y que no es ninguna de las bases
  // protegidas: si la guardia fallara, lo peor que puede pasar es un archivo
  // vacío de más, nunca tocar `dev.db`.
  const directorio = await mkdtemp(join(tmpdir(), "erp-guardia-"));
  const sonda = join(directorio, "sonda.test.ts");
  const baseProhibida = "./.guardia-no-deberia-existir.db";
  await writeFile(
    sonda,
    ['import { test } from "node:test";', 'import "@/lib/prisma";', 'test("x", () => {});', ""].join(
      "\n"
    ),
    "utf8"
  );

  try {
    const resultado = correrPruebaSuelta(sonda, `file:${baseProhibida}`);
    const salida = `${resultado.stdout}${resultado.stderr}`;
    assert.notEqual(resultado.status, 0, "la prueba suelta debería haber fallado");
    assert.match(salida, /está dentro del repositorio/);
    assert.match(salida, /run-tests\.mjs/);
    // Y no se creó el archivo: la negativa ocurre antes de abrir nada.
    await assert.rejects(stat(resolve(process.cwd(), baseProhibida)));
  } finally {
    await rm(directorio, { recursive: true, force: true });
    await rm(resolve(process.cwd(), baseProhibida), { force: true });
  }
});

test("la base efímera del runner sí pasa", async () => {
  // La guardia tiene que dejar trabajar a la suite: la base de las pruebas
  // vive fuera del repositorio, en el temporal del sistema.
  const directorio = await mkdtemp(join(tmpdir(), "erp-guardia-ok-"));
  const sonda = join(directorio, "sonda.test.ts");
  await writeFile(
    sonda,
    ['import { test } from "node:test";', 'import "@/lib/prisma";', 'test("x", () => {});', ""].join(
      "\n"
    ),
    "utf8"
  );

  try {
    const base = join(directorio, "efimera.db").replaceAll("\\", "/");
    const resultado = correrPruebaSuelta(sonda, `file:${base}`);
    const salida = `${resultado.stdout}${resultado.stderr}`;
    assert.equal(resultado.status, 0, salida);
    assert.doesNotMatch(salida, /está dentro del repositorio/);
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("fuera de una prueba, la guardia no estorba", () => {
  // El servidor y los scripts trabajan contra la base del repositorio: es su
  // trabajo. La guardia solo mira cuando el proceso es del runner de pruebas.
  //
  // `NODE_TEST_CONTEXT` se borra a mano porque un hijo lanzado DESDE una
  // prueba la hereda. Esa herencia es deseable —algo que una prueba dispara
  // sigue siendo una prueba— y es justamente lo que hay que anular para
  // representar aquí al servidor, que no lo es.
  const { NODE_TEST_CONTEXT, ...heredado } = process.env;
  void NODE_TEST_CONTEXT;
  const entorno = { ...heredado, DATABASE_URL: "file:./.guardia-fuera-de-prueba.db" };
  const resultado = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", 'import("@/lib/prisma").then(() => console.log("conectado"));'],
    { cwd: process.cwd(), encoding: "utf8", env: entorno }
  );
  try {
    assert.match(`${resultado.stdout}${resultado.stderr}`, /conectado/);
  } finally {
    spawnSync(process.execPath, [
      "-e",
      'require("node:fs").rmSync(".guardia-fuera-de-prueba.db", { force: true })',
    ]);
  }
});
