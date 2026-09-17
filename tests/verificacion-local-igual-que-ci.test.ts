import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Que verificar en local sea lo mismo que verificar en CI.
//
// Las dos listas no eran la misma y la diferencia costaba ciclos enteros:
// `prisma format --check` solo corría en CI, y `lint` corre allá con
// `--max-warnings=0` y acá sin él. Todo lo demás pasaba en verde, el PR se
// abría, y once minutos después fallaba por espacios en el schema.
//
// Un comentario que pide mantener dos archivos sincronizados no sincroniza
// nada. Esta prueba sí: si CI gana un paso y `npm run verificar` no, falla.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

/** Los comandos que CI ejecuta después de preparar la base. */
async function comandosDeCI(): Promise<string[]> {
  const flujo = await readFile(resolve(RAIZ, ".github/workflows/ci.yml"), "utf8");
  // Todo lo que viene después de crear la base es verificación; lo de antes es
  // instalar dependencias y levantar PostgreSQL, que en local ya está.
  const desde = flujo.indexOf("Create the build database");
  assert.notEqual(desde, -1, "el flujo de CI cambió de forma y esta prueba ya no sabe leerlo");

  // El prefijo `run:` se quita ANTES de filtrar. Al revés —que es como estaba
  // primero— los pasos de una sola línea (`run: npx prisma generate`) no
  // empiezan por «npx» y se perdían, dejando la comparación casi vacía. Lo
  // detectó la prueba de sanidad de abajo, que existe justo para eso.
  return flujo
    .slice(desde)
    .split(/\r?\n/)
    .map((linea) => linea.trim().replace(/^run:\s*/, ""))
    .filter((linea) => linea.startsWith("npx ") || linea.startsWith("npm "));
}

test("el flujo de CI declara los pasos que esta prueba espera leer", async () => {
  const comandos = await comandosDeCI();
  // Si esto baja de cinco, o el flujo cambió o la lectura se rompió — y en los
  // dos casos la comparación de abajo pasaría por vacía.
  assert.ok(
    comandos.length >= 5,
    `solo se leyeron ${comandos.length} comandos de CI: la prueba quedaría vacía`
  );
});

test("todo lo que corre CI lo corre también `npm run verificar`", async () => {
  const comandos = await comandosDeCI();
  const script = await readFile(resolve(RAIZ, "scripts/verificar.mjs"), "utf8");

  for (const comando of comandos) {
    assert.ok(
      script.includes(comando),
      `CI corre «${comando}» y la verificación local no. Esa diferencia se descubre once minutos después, en el PR.`
    );
  }
});

test("el lint local exige lo mismo que el de CI", async () => {
  // La divergencia menos visible: `npm run lint` a secas pasa con advertencias
  // y CI las trata como error.
  const script = await readFile(resolve(RAIZ, "scripts/verificar.mjs"), "utf8");
  assert.match(script, /--max-warnings=0/);
});

test("el script está enganchado a un comando de npm", async () => {
  // Un script que hay que recordar invocar por su ruta no lo invoca nadie.
  const paquete = JSON.parse(await readFile(resolve(RAIZ, "package.json"), "utf8"));
  assert.equal(paquete.scripts.verificar, "node scripts/verificar.mjs");
});

test("se detiene en el primer paso que falla", async () => {
  // Seguir después de un fallo llenaría la pantalla de errores derivados y
  // escondería el primero, que es el único que importa.
  const script = await readFile(resolve(RAIZ, "scripts/verificar.mjs"), "utf8");
  assert.match(script, /process\.exit\(/);
  assert.match(script, /no se ejecutaron/);
});

test("no falla por los tipos que genera el servidor de desarrollo", async () => {
  // `next dev` escribe tipos en `.next/dev/types` que entran al `tsc` del
  // proyecto. Interrumpirlo deja el archivo truncado y `tsc` falla señalando
  // algo que nadie escribió — pasó la primera vez que se corrió este script.
  //
  // CI nunca los tiene: borrarlos es parecerse más a CI, no menos.
  const script = await readFile(resolve(RAIZ, "scripts/verificar.mjs"), "utf8");
  assert.match(script, /\.next\/dev\/types/);
  assert.match(script, /rmSync\(/);
});
