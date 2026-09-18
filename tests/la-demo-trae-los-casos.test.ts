import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Una demo puede estar «cargada» y no mostrar nada.
//
// Corriendo los sembradores desde una base VACÍA por primera vez aparecieron
// dos agujeros que ninguna prueba veía, porque todo se había probado siempre
// contra `erp_dev` —que tenía datos cargados a mano meses antes—:
//
//   1. Ningún lote del proveedor llegaba en dos recepciones, así que el aviso
//      de «alcance ampliado» del recall no aparecía nunca.
//   2. Ningún ensayo declaraba con qué instrumento se midió. Peor: los
//      controles de calidad de la demo no tenían NINGUNA medición, así que el
//      certificado de análisis ni siquiera abría —lo exige— y «Qué hay que
//      reensayar» decía que no hay nada.
//
// Tres pantallas en blanco en una instalación recién sembrada. Quien la
// estrena no concluye «faltan datos»: concluye que la función no está.
//
// La comprobación de verdad es `npm run semillas:desde-cero`, que siembra una
// base efímera y verifica los casos ejecutando las mismas consultas que las
// pantallas. No entra en `npm test` porque sembrar la demo entera tarda y la
// suite ya dura ocho minutos. Lo de acá es la guarda barata: que el script
// exista y que los sembradores no pierdan lo que hace que los casos ocurran.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const leer = (ruta: string) => readFile(resolve(RAIZ, ruta), "utf8");

test("hay un comando para sembrar desde cero y comprobar los casos", async () => {
  const paquete = JSON.parse(await leer("package.json")) as { scripts: Record<string, string> };
  assert.equal(paquete.scripts["semillas:desde-cero"], "node scripts/probar-semillas.mjs");
});

test("la base efímera lleva el prefijo que autoriza a destruirla", async () => {
  // La garantía de que esto no toca `erp_dev` es el NOMBRE: los ayudantes solo
  // destruyen bases que empiezan por el prefijo de pruebas.
  const script = await leer("scripts/probar-semillas.mjs");
  assert.match(script, /PREFIJO_BASE_PRUEBAS \+ "semillas_"/);
  assert.match(script, /eliminarBase\(plantilla, nombreBase, PREFIJO_BASE_PRUEBAS\)/);
  // Y se destruye pase lo que pase.
  assert.match(script, /\} finally \{/);
});

test("el script comprueba los casos ejecutando, no leyendo código", async () => {
  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /revisarReensayos\(EMPRESA_ID\)/, "no ejecuta la derivación de reensayos");
  assert.match(casos, /process\.exit\(1\)/, "no falla cuando falta un caso");
});

test("la compra registra el lote del proveedor", async () => {
  // El campo existía y nadie lo llenaba: sin él la pantalla de recall se abre
  // pero no se puede estrenar.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /numeroLoteProveedor: string \| null = null/);
  assert.match(semilla, /cantidadDisponible: cantidad, numeroLoteProveedor/);
});

test("un lote del proveedor llega en dos entregas, y la segunda queda sin consumir", async () => {
  // Es el caso que la pantalla de recall existe para contestar. La segunda
  // entrega va después de producción a propósito: así queda en almacén y el
  // recall puede decir cuánto del lote sospechoso sigue sin consumirse.
  const semilla = await leer("prisma/seed-demo.ts");
  const compras = semilla.match(/comprarInsumo\([^)]*"AB-2026-014"\)/g) ?? [];
  assert.equal(compras.length, 2, `el lote AB-2026-014 se compra ${compras.length} vez/veces`);

  const produccion = semilla.indexOf("const lote1 = await producirLote");
  const segunda = semilla.lastIndexOf('"AB-2026-014")');
  assert.ok(
    segunda > produccion,
    "la segunda entrega quedó antes de producción: se consumiría y no habría saldo que inmovilizar"
  );
});

test("el laboratorio deja escrito qué se midió al liberar", async () => {
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /async function sembrarMedicionesDeLiberacion\(\)/);
  assert.match(semilla, /await sembrarMedicionesDeLiberacion\(\);/, "la función está pero no se llama");
  // Del plan publicado, con su instrumento: no valores inventados sueltos.
  assert.match(semilla, /instrumentoId: c\.instrumentoId/);
  assert.match(semilla, /planInspeccionId: plan\.id, planVersion: plan\.version/);
});

test("no se pisan los ensayos que alguien cargó", async () => {
  // Solo se escribe sobre controles SIN mediciones. Un ensayo cargado por
  // pantalla es trabajo de una persona.
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /resultadosCaracteristica: \{ none: \{\} \}/);
  // Y sin plan publicado no se inventa qué se midió.
  assert.match(semilla, /if \(!plan \|\| plan\.caracteristicas\.length === 0\)/);
});

test("la densidad medida queda en el lote, como cuando se carga por pantalla", async () => {
  // Es el número que convierte kg en litros en los comprobantes. Dejarlo en
  // null haría que el lote use la del producto sin que nadie lo note.
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /data: \{ densidadKgL: densidad \}/);
});
