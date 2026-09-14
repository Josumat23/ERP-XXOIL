import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Los documentos citan archivos que existen.
//
// El roadmap es el registro principal del proyecto y está lleno de «Véase
// `docs/...`». Una cita rota no es un detalle de forma: convierte en
// incomprobable la afirmación que sostiene. El 2026-09-14 había ocho, todas
// apuntando a `docs/gobernanza/010-AI/...` cuando esa documentación vive en
// `000-Governance/010-AI/...` — dos raíces de gobernanza distintas, que es
// justamente cómo se confunden.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

/** Rutas del repositorio citadas entre comillas invertidas. */
const CITA = /`((?:docs|src|prisma|scripts|tests|000-Governance)\/[A-Za-z0-9._/()[\]@-]+)`/g;

async function documentos(dir: string, acc: string[] = []): Promise<string[]> {
  for (const nombre of await readdir(dir)) {
    const ruta = join(dir, nombre);
    if ((await stat(ruta)).isDirectory()) await documentos(ruta, acc);
    else if (ruta.endsWith(".md")) acc.push(ruta);
  }
  return acc;
}

test("ninguna cita de la documentación apunta a un archivo que no existe", async () => {
  const fuentes = [
    ...(await documentos(resolve(RAIZ, "docs"))),
    resolve(RAIZ, "README.md"),
    resolve(RAIZ, "AGENTS.md"),
  ].filter((f) => existsSync(f));

  const rotas: string[] = [];
  let comprobadas = 0;

  for (const archivo of fuentes) {
    const texto = await readFile(archivo, "utf8");
    for (const cita of texto.matchAll(CITA)) {
      const ruta = cita[1];
      // Un comodín (`docs/integridad-fk-empresa-*.md`) o unos puntos
      // suspensivos (`000-Governance/010-AI/...`) describen un conjunto de
      // archivos, no uno concreto: no hay nada que comprobar.
      if (ruta.includes("*") || ruta.includes("...")) continue;
      comprobadas++;
      if (existsSync(join(RAIZ, ruta))) continue;
      const linea = texto.slice(0, cita.index).split("\n").length;
      rotas.push(`${relative(RAIZ, archivo).replaceAll("\\", "/")}:${linea} → ${ruta}`);
    }
  }

  // Si esto queda en cero, la guardia dejó de mirar y pasaría siempre.
  assert.ok(comprobadas > 150, `solo ${comprobadas} referencias comprobadas`);
  assert.deepEqual(rotas, [], `Citas a archivos inexistentes:\n  ${rotas.join("\n  ")}`);
});

test("la guardia distingue una ruta viva de una inventada", () => {
  // Comprueba el mecanismo, no el contenido: si `existsSync` dejara de
  // discriminar, la prueba anterior pasaría con cualquier cosa.
  assert.equal(existsSync(join(RAIZ, "docs/backup-restauracion.md")), true);
  assert.equal(existsSync(join(RAIZ, "docs/este-archivo-no-existe.md")), false);
});
