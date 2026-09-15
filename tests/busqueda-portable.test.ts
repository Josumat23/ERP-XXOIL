import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { contiene } from "@/lib/busqueda";
import { prisma } from "@/lib/prisma";

// SQLite y PostgreSQL no buscan igual. En SQLite `LIKE` es insensible a
// mayúsculas para ASCII; en PostgreSQL es sensible, y Prisma traduce
// `contains` a `LIKE` salvo que se le pida `mode: "insensitive"`, que genera
// `ILIKE`.
//
// Sin eso, la migración del 2026-09-15 habría dejado de encontrar «FERRETERIA
// SAN MARTIN» al buscar «ferreteria» en las 32 pantallas con buscador — sin un
// error y sin una línea de log.
//
// El día anterior se reunieron los 63 usos en un solo ayudante, con `mode`
// todavía imposible (no existe en los tipos que Prisma genera para SQLite: no
// compilaba). El arreglo fue, efectivamente, una línea en un archivo.

async function archivos(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (entrada.name === "generated") continue;
    const ruta = resolve(dir, entrada.name);
    if (entrada.isDirectory()) await archivos(ruta, acc);
    else if (/\.tsx?$/.test(entrada.name)) acc.push(ruta);
  }
  return acc;
}

test("el ayudante busca sin distinguir mayúsculas", () => {
  // `mode: "insensitive"` es lo que hace que PostgreSQL emita `ILIKE`, que es
  // exactamente lo que SQLite hacía con `LIKE`. Sin él, la migración habría
  // cambiado en silencio el resultado de las 32 pantallas con buscador.
  assert.deepEqual(contiene("ferreteria"), { contains: "ferreteria", mode: "insensitive" });
  // El texto pasa tal cual: recortarlo o normalizarlo acá cambiaría en
  // silencio lo que el usuario escribió.
  assert.deepEqual(contiene("  con espacios  "), {
    contains: "  con espacios  ",
    mode: "insensitive",
  });
  assert.deepEqual(contiene(""), { contains: "", mode: "insensitive" });
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

test("contra el motor de verdad: minúsculas encuentran mayúsculas", async () => {
  // Esta es la única comprobación que importa, y es la que no existía antes:
  // las otras miran el código, ésta mira lo que PostgreSQL devuelve.
  //
  // El catálogo UBIGEO viene de SUNAT en MAYÚSCULAS y lo siembra el runner, así
  // que sirve de testigo sin inventar datos. Con `LIKE` a secas esto devuelve
  // cero filas.
  const enMinusculas = await prisma.ubigeo.findMany({
    where: { distrito: contiene("chachapoyas") },
    select: { distrito: true },
  });
  assert.ok(enMinusculas.length > 0, "buscar en minúsculas no encontró el distrito en MAYÚSCULAS");
  assert.ok(enMinusculas.every((u) => u.distrito === u.distrito.toUpperCase()));

  // Y al revés, que es lo que ya funcionaba y no debe romperse.
  const enMayusculas = await prisma.ubigeo.findMany({
    where: { distrito: contiene("CHACHAPOYAS") },
    select: { distrito: true },
  });
  assert.equal(enMayusculas.length, enMinusculas.length);

  // Las tildes NO se pliegan, en ningún motor: buscar «chachapóyas» no
  // encuentra nada. Está acá para que se lea como una decisión y no como un
  // descuido; plegarlas exigiría `unaccent` y una decisión que nadie tomó.
  assert.equal(
    (await prisma.ubigeo.count({ where: { distrito: contiene("chachapóyas") } })),
    0
  );
});

test("el ayudante explica por qué existe", async () => {
  // Quien lo abra tiene que encontrar la medición contra los dos motores, no
  // solo una función de una línea.
  const fuente = await readFile(resolve(process.cwd(), "src/lib/busqueda.ts"), "utf8");
  assert.match(fuente, /mode: "insensitive"/);
  assert.match(fuente, /ILIKE/);
});
