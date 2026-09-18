import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// El módulo de RRHH estaba construido y vacío.
//
// Un barrido de las pantallas del sistema encontró que 15 pantallas de detalle
// no se pueden ni abrir, porque no hay un solo registro que mirar. RRHH era una
// de ellas: cero empleados, cero posiciones, cero planillas. Siete pantallas
// construidas sin nada que mostrar.
//
// Dos decisiones que estas guardas protegen:
//
// 1. La planilla NO se escribe a mano. El módulo tiene su motor de cálculo
//    —aportes, descuentos, quinta categoría y el asiento contable— y escribir
//    los importes en el sembrador sería una segunda implementación del
//    cálculo. La que quedara vieja sería la del sembrador, y los números de la
//    demo dirían una cosa mientras la pantalla dice otra.
//
// 2. RMV, UIT y las tasas de AFP son valores LEGALES que fija el Estado y
//    cambian. Van como datos de prueba para que el cálculo corra, NO como una
//    afirmación de cuánto valen hoy, y el sembrador lo dice al terminar.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const SEMBRADOR = "prisma/seed-rrhh.ts";
const leer = (ruta: string) => readFile(resolve(RAIZ, ruta), "utf8");

test("hay un comando para sembrar RRHH", async () => {
  const paquete = JSON.parse(await leer("package.json")) as { scripts: Record<string, string> };
  assert.equal(paquete.scripts["seed:rrhh"], "tsx prisma/seed-rrhh.ts");
});

test("la planilla la calcula el motor del módulo, no el sembrador", async () => {
  const semilla = await leer(SEMBRADOR);
  assert.match(semilla, /import \{ generarPlanillaMensual \} from "\.\.\/src\/lib\/planilla"/);
  assert.match(semilla, /generarPlanillaMensual\(tx, \{/);
  // Ni un importe de planilla escrito a mano: nada de aportes, descuentos ni
  // netos calculados acá.
  assert.doesNotMatch(semilla, /planillaDetalle\.create/, "el sembrador escribe boletas a mano");
  assert.doesNotMatch(semilla, /planillaPeriodo\.create/, "el sembrador crea el período a mano");
});

test("los valores legales se declaran como datos de prueba, no como la ley", async () => {
  const semilla = await leer(SEMBRADOR);
  assert.match(semilla, /PARAMETROS_DE_PRUEBA/);
  assert.match(semilla, /NO son una afirmación de/, "no advierte que son valores de prueba");
  assert.match(
    semilla,
    /RRHH → Planilla → Parámetros/,
    "no dice dónde se cargan los valores de verdad"
  );
  // EsSalud y ONP no se inventan acá: vienen por omisión del esquema.
  assert.doesNotMatch(semilla, /tasaEsSalud:/, "el sembrador fija la tasa de EsSalud");
  assert.doesNotMatch(semilla, /tasaOnp:/, "el sembrador fija la tasa de ONP");
});

test("las personas son inventadas, y se dice", async () => {
  // Un sembrador viaja con el repositorio y termina en demos y capturas. El
  // nombre, el DNI o el sueldo de alguien real ahí es el dato de un tercero.
  const semilla = await leer(SEMBRADOR);
  assert.match(semilla, /Las personas son inventadas/);
  // DNI con el formato de ocho dígitos pero empezando por 00, que no se asigna.
  const dnis = [...semilla.matchAll(/dni: "(\d{8})"/g)].map((m) => m[1]);
  assert.ok(dnis.length >= 5, `solo ${dnis.length} DNI en la plantilla`);
  for (const d of dnis) {
    assert.ok(d.startsWith("00"), `el DNI ${d} no empieza por 00: podría ser el de alguien`);
  }
});

test("la plantilla trae los casos que las pantallas explican", async () => {
  const semilla = await leer(SEMBRADOR);
  // Sin sistema de pensión: el módulo documenta que se excluye de la corrida
  // con una advertencia. Sin un caso así, esa advertencia no se ve nunca.
  assert.match(semilla, /SIN sistema de pensión: la corrida lo excluye/);
  assert.match(semilla, /locación de servicios: no entra en planilla/);
  assert.match(semilla, /cesado: rotación y headcount/);
  assert.match(semilla, /asignación familiar/);
});

test("el organigrama tiene forma de árbol y una posición vacante", async () => {
  const semilla = await leer(SEMBRADOR);
  assert.match(semilla, /jefeDirectoId: porCodigo\.get\(p\.jefe\)/);
  // Las jefaturas van en una segunda pasada: un jefe puede estar más abajo en
  // la lista que quien le reporta.
  assert.match(semilla, /en una segunda pasada/);
  assert.match(semilla, /ocupa: null/, "no hay ninguna posición vacante");
});

test("no se pisa lo que ya esté cargado", async () => {
  const semilla = await leer(SEMBRADOR);
  assert.match(semilla, /if \(yaHay > 0\)/);
  assert.match(semilla, /no se toca nada/);
});

test("el sembrador entra en la comprobación desde cero", async () => {
  const script = await leer("scripts/probar-semillas.mjs");
  assert.match(script, /\["RRHH", "prisma\/seed-rrhh\.ts"\]/);
  // Y se repite, porque tiene que ser idempotente.
  assert.match(script, /\["RRHH \(otra vez\)", "prisma\/seed-rrhh\.ts"\]/);

  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /hay una planilla corrida con deta/);
  assert.match(casos, /la advertencia de la corrida/);
});
