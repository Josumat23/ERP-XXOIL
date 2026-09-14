import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

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

const RAIZ = process.cwd();

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

// ---------------------------------------------------------------------------
// Todo punto de entrada que corre en su propio proceso.
//
// Esto empezó siendo dos comprobaciones a mano —`server.ts` y el respaldo— y
// se generalizó el 2026-09-14, cuando el fallo ruidoso atrapó un tercero:
// `npm run seed:demo` habría volcado seis meses de datos inventados dentro de
// `dev.db`. Escribir la lista a mano es justamente cómo se escapó ese tercero.
// ---------------------------------------------------------------------------

/** Archivos que Node/tsx arrancan directamente, fuera de Next. */
async function puntosDeEntrada(): Promise<string[]> {
  const rutas = [resolve(RAIZ, "server.ts")];
  for (const carpeta of ["prisma", "scripts"]) {
    for (const nombre of await readdir(resolve(RAIZ, carpeta))) {
      if (/\.(ts|mjs)$/.test(nombre)) rutas.push(resolve(RAIZ, carpeta, nombre));
    }
  }
  return rutas.filter((r) => existsSync(r));
}

/** El código, sin comentarios: una frase en prosa no es una decisión. */
const sinComentarios = (fuente: string) =>
  fuente.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

test("ningún punto de entrada lleva una ruta de base escrita a mano", async () => {
  // Un valor por defecto vuelve silencioso el olvido de configurar. Había
  // cinco copias de la misma línea: `prisma.ts` y los cuatro sembradores.
  const culpables: string[] = [];
  for (const ruta of [...(await puntosDeEntrada()), resolve(RAIZ, "src/lib/prisma.ts")]) {
    const fuente = sinComentarios(await readFile(ruta, "utf8"));
    if (/"file:\.\//.test(fuente)) culpables.push(relative(RAIZ, ruta).replaceAll("\\", "/"));
  }
  assert.deepEqual(culpables, [], `Rutas de base literales en:\n  ${culpables.join("\n  ")}`);
});

test("todo punto de entrada carga el .env antes de importar módulos propios", async () => {
  // La regla es incondicional a propósito. El intento anterior preguntaba
  // "¿este archivo usa la base?" y se equivocó en las dos direcciones: no veía
  // `server.ts`, que llega a Prisma por un import indirecto, y excluía el
  // respaldo por una frase que decía «DATABASE_URL:» dentro de un comentario.
  //
  // Cargar `.env` de más no cuesta nada; no cargarlo cuesta escribir en la
  // base equivocada. Los únicos exentos son los lanzadores que ARMAN la
  // variable para su proceso hijo, y eso se comprueba en el código, no se
  // supone.
  const rutas = await puntosDeEntrada();
  assert.ok(rutas.length >= 8, `solo ${rutas.length} puntos de entrada encontrados`);

  const revisados: string[] = [];
  const culpables: string[] = [];

  for (const ruta of rutas) {
    const fuente = await readFile(ruta, "utf8");
    const codigo = sinComentarios(fuente);
    // Un lanzador que define DATABASE_URL para su hijo no depende de `.env`.
    if (/DATABASE_URL\s*[:=]/.test(codigo)) continue;

    const primerPropio = fuente.search(/^\s*(?:import .* from|const .* = require\()\s*"(?:\.\.?\/|@\/)/m);
    if (primerPropio === -1) continue; // no importa nada del repositorio

    const nombre = relative(RAIZ, ruta).replaceAll("\\", "/");
    revisados.push(nombre);

    const dotenv = fuente.indexOf('"dotenv/config"');
    if (dotenv === -1) culpables.push(`${nombre}: no carga .env`);
    else if (dotenv > primerPropio) {
      culpables.push(`${nombre}: carga .env después de importar módulos propios`);
    }
  }

  assert.ok(revisados.length >= 6, `solo ${revisados.length} archivos revisados: ${revisados}`);
  assert.deepEqual(culpables, [], `Puntos de entrada sin entorno:\n  ${culpables.join("\n  ")}`);
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
