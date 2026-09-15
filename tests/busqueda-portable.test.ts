import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { contiene } from "@/lib/busqueda";

// SQLite y PostgreSQL no buscan igual. En SQLite `LIKE` es insensible a
// mayúsculas para ASCII; en PostgreSQL es sensible, y Prisma traduce
// `contains` a `LIKE` salvo que se le pida `mode: "insensitive"`.
//
// Sin eso, el día de la migración buscar «ferreteria» dejaría de encontrar
// «FERRETERIA SAN MARTIN» en las 32 pantallas con buscador — sin un error y
// sin una línea de log.
//
// `mode` no existe en los tipos que Prisma genera para SQLite, así que no se
// puede agregar todavía. Lo que sí se hizo fue reunir los 63 usos en un solo
// ayudante: el día de la migración es una línea en un archivo.

async function archivos(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (entrada.name === "generated") continue;
    const ruta = resolve(dir, entrada.name);
    if (entrada.isDirectory()) await archivos(ruta, acc);
    else if (/\.tsx?$/.test(entrada.name)) acc.push(ruta);
  }
  return acc;
}

test("el ayudante produce el filtro que Prisma espera", () => {
  assert.deepEqual(contiene("ferreteria"), { contains: "ferreteria" });
  // El texto pasa tal cual: recortarlo o normalizarlo acá cambiaría en
  // silencio lo que el usuario escribió.
  assert.deepEqual(contiene("  con espacios  "), { contains: "  con espacios  " });
  assert.deepEqual(contiene(""), { contains: "" });
});

test("ninguna pantalla escribe `contains` por su cuenta", async () => {
  // Si vuelven a dispersarse, la migración a PostgreSQL vuelve a ser 63
  // ediciones en 32 pantallas en vez de una línea — y basta olvidar una para
  // que ese buscador quede roto en silencio.
  const rutas = await archivos(resolve(process.cwd(), "src"));
  assert.ok(rutas.length > 100, `solo ${rutas.length} archivos revisados`);

  const culpables: string[] = [];
  for (const ruta of rutas) {
    const relativa = ruta.replaceAll("\\", "/").split("/src/")[1];
    if (relativa === "lib/busqueda.ts") continue;
    const texto = (await readFile(ruta, "utf8")).replace(/^\s*(?:\/\/|\*|\/\*).*$/gm, "");
    if (!/\bcontains\s*:/.test(texto)) continue;
    const linea = texto.split("\n").findIndex((l) => /\bcontains\s*:/.test(l)) + 1;
    culpables.push(`${relativa}:${linea}`);
  }

  assert.deepEqual(
    culpables,
    [],
    `Estas pantallas escriben \`contains\` en vez de usar \`contiene()\`:\n  ${culpables.join("\n  ")}`
  );
});

test("el ayudante está de verdad en uso", async () => {
  // Una guardia que prohíbe algo que nadie usaría igual no protege nada: lo
  // que la hace útil es que haya 63 usos detrás.
  const rutas = await archivos(resolve(process.cwd(), "src"));
  let usos = 0;
  let pantallas = 0;
  for (const ruta of rutas) {
    if (ruta.endsWith("busqueda.ts")) continue;
    const texto = await readFile(ruta, "utf8");
    const encontrados = texto.match(/\bcontiene\(/g);
    if (!encontrados) continue;
    usos += encontrados.length;
    pantallas++;
    // Y cada una lo importa: sin el import no compilaría, pero comprobarlo
    // acá hace que el mensaje diga cuál falta en vez de un error de tipos.
    assert.ok(
      texto.includes('from "@/lib/busqueda"'),
      `${ruta} usa contiene() sin importarlo`
    );
  }
  assert.ok(usos >= 60, `solo ${usos} usos del ayudante`);
  assert.ok(pantallas >= 30, `solo ${pantallas} pantallas`);
});

test("el ayudante explica qué hay que cambiar al migrar", async () => {
  // El día de la migración, quien abra este archivo tiene que encontrar la
  // instrucción y la medición, no solo una función de una línea.
  const fuente = await readFile(resolve(process.cwd(), "src/lib/busqueda.ts"), "utf8");
  assert.match(fuente, /mode: "insensitive"/);
  assert.match(fuente, /ILIKE/);
});
