import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Lo que la pantalla RENDERIZA con otra compañía activa.
//
// El aislamiento multiempresa es la preocupación más documentada del proyecto
// —más de veinte documentos— y las pruebas lo verifican consulta por consulta.
// Lo que ninguna verificaba es el resultado: una consulta puede estar bien y la
// pantalla mostrar datos ajenos por otro camino —un componente compartido, un
// `include` anidado, un panel que se monta con un id.
//
// `npm run fugas:entre-empresas` lo comprueba de punta a punta, por HTTP, con
// DOS compañías AMBAS con datos. Con una vacía solo se detecta «la consulta no
// filtra»; con dos pobladas se detecta además «filtra por la compañía
// equivocada», que es el error más silencioso de los dos.
//
// No entra en `npm test` porque necesita el servidor levantado y la base demo
// con las dos compañías. Lo de acá es la guarda barata: que el comando exista
// y que no pierda lo que lo hace capaz de detectar algo.
//
// Corrida la primera vez sobre 28 pantallas y en las dos direcciones: ninguna
// mostró datos de la otra compañía. Y quitando a mano el filtro por compañía
// de la lista de clientes, las dos direcciones se ponen en rojo con los
// nombres exactos que se filtraron — la comprobación no pasa por no mirar.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const leer = (ruta: string) => readFile(resolve(RAIZ, ruta), "utf8");
const SCRIPT = "scripts/fugas-entre-empresas.ts";

test("hay un comando para buscar fugas entre compañías", async () => {
  const paquete = JSON.parse(await leer("package.json")) as { scripts: Record<string, string> };
  assert.equal(paquete.scripts["fugas:entre-empresas"], "tsx scripts/fugas-entre-empresas.ts");
});

test("nunca mira la base de trabajo", async () => {
  // El nombre de la base se fija en el script: una `DATABASE_URL` heredada no
  // puede redirigirlo a `erp_dev`.
  const script = await leer(SCRIPT);
  assert.match(script, /url\.pathname = "\/erp_demo"/);
});

test("compara sobre el texto visible, no sobre el HTML", async () => {
  // La primera versión dio un falso positivo con `DM-01`, que no era un dato
  // sino el PLACEHOLDER del campo «Código» en el formulario de alta. Una
  // comprobación que marca lo que no es se termina ignorando.
  const script = await leer(SCRIPT);
  assert.match(script, /function textoVisible/);
  assert.match(script, /replace\(\/<\[\^>\]\*>\/g, " "\)/, "no quita las etiquetas");
  assert.match(script, /<script\[\\s\\S\]\*\?<\\\/script>/, "no quita los scripts");
});

test("comprueba las dos direcciones", async () => {
  // Que la segunda no vea a la primera Y que la primera no vea a la segunda.
  // Con una sola dirección, una consulta que filtrara siempre por la compañía
  // equivocada pasaría a medias.
  const script = await leer(SCRIPT);
  assert.match(script, /La dirección inversa también/);
  const barridos = script.match(/await barrer\(token,/g) ?? [];
  assert.equal(barridos.length, 2, `solo ${barridos.length} dirección(es) comprobada(s)`);
});

test("lo que ambas compañías usan no cuenta como fuga", async () => {
  // Coincidir en un nombre no prueba nada: dos compañías pueden tener un
  // cliente que se llame igual.
  const script = await leer(SCRIPT);
  assert.match(script, /const comunes = new Set/);
  assert.match(script, /!comunes\.has\(m\)/);
});

test("falla de verdad cuando encuentra algo", async () => {
  // Una comprobación que informa y termina en verde no es una comprobación.
  const script = await leer(SCRIPT);
  assert.match(script, /process\.exit\(1\)/);
  // Y exige dos compañías: con una sola no puede detectar el error silencioso.
  assert.match(script, /empresas\.length < 2/);
});
