import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// La base sale de la configuración, nunca de un valor por defecto.
//
// `src/lib/prisma.ts` decía `process.env.DATABASE_URL ?? "file:./dev.db"`. Ese
// nombre es, en la copia de trabajo original, una base PROTEGIDA: un proceso
// que llegara sin `DATABASE_URL` no fallaba, se conectaba en silencio a la base
// que no debía tocar.
//
// Y eso es justamente lo que hacía `npm run dev`: `server.ts` no es una ruta de
// Next, así que nadie cargaba `.env` por él; importaba `tareasProgramadas` —y
// con él `@/lib/prisma`— con la variable sin definir, y el planificador
// arrancaba contra `dev.db` con `.env` o sin él. Pasó el 2026-09-14.
// ---------------------------------------------------------------------------

function sinVariableDeBase() {
  const { DATABASE_URL, NODE_TEST_CONTEXT, ...heredado } = process.env;
  void DATABASE_URL;
  void NODE_TEST_CONTEXT;
  return heredado;
}

test("sin DATABASE_URL el proceso falla en vez de adivinar la base", async () => {
  const resultado = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", 'import("@/lib/prisma").then(() => console.log("conectado"));'],
    { cwd: process.cwd(), encoding: "utf8", env: sinVariableDeBase() }
  );
  const salida = `${resultado.stdout}${resultado.stderr}`;
  assert.doesNotMatch(salida, /conectado/, "se conectó a algo sin que nadie se lo dijera");
  assert.match(salida, /Falta DATABASE_URL/);
  // El mensaje tiene que decir qué hacer, no solo que algo falta.
  assert.match(salida, /\.env/);
});

test("ningún módulo lleva una ruta de base escrita a mano", async () => {
  // Un valor por defecto aquí vuelve silencioso el olvido de configurar.
  const fuente = (await readFile(resolve(process.cwd(), "src/lib/prisma.ts"), "utf8")).replace(
    /^\s*\/\/.*$/gm,
    ""
  );
  assert.doesNotMatch(fuente, /"file:\.\//, "hay una ruta de base literal en prisma.ts");
  assert.match(fuente, /process\.env\.DATABASE_URL/);
});

test("el servidor carga .env antes de tocar sus propios módulos", async () => {
  // `server.ts` corre fuera de Next: si importa `./src/lib/...` antes de
  // cargar `.env`, Prisma se evalúa con el entorno vacío.
  const fuente = await readFile(resolve(process.cwd(), "server.ts"), "utf8");
  const dotenv = fuente.indexOf('import "dotenv/config"');
  assert.ok(dotenv !== -1, "server.ts no carga .env");
  const primerModuloPropio = fuente.search(/^import .* from "\.\/src\//m);
  assert.ok(primerModuloPropio !== -1, "no se encontró ningún import propio");
  assert.ok(
    dotenv < primerModuloPropio,
    "dotenv se carga después de importar módulos que ya leyeron el entorno"
  );
});

test("el respaldo manual también carga .env", async () => {
  // Corre en su propio proceso bajo tsx, fuera de Next y del servidor: sin
  // esto, DATABASE_URL y RESPALDO_DIR llegan vacías y el comando dice que no
  // hay base que respaldar aunque esté configurada.
  const fuente = await readFile(resolve(process.cwd(), "scripts/respaldo.ts"), "utf8");
  const dotenv = fuente.indexOf('import "dotenv/config"');
  assert.ok(dotenv !== -1, "scripts/respaldo.ts no carga .env");
  assert.ok(dotenv < fuente.indexOf('from "@/lib/respaldo"'));
});

test("sin DATABASE_URL no se crea ninguna base suelta", async () => {
  // El fallo tiene que ocurrir antes de abrir nada.
  const resultado = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", 'import("@/lib/prisma");'],
    { cwd: process.cwd(), encoding: "utf8", env: sinVariableDeBase() }
  );
  assert.notEqual(resultado.status, 0);
  await assert.rejects(stat(resolve(process.cwd(), "dev.db.nuevo")));
});
