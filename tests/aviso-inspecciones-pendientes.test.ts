import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { senalInspeccionesPendientes } from "@/lib/semaforo";

// ---------------------------------------------------------------------------
// Inspecciones de entrada que nadie resolvió.
//
// Nace de un efecto secundario del ciclo anterior. Mientras la recepción
// retenía el material, una inspección olvidada se hacía notar sola: producción
// venía a reclamar su materia prima. Desde que el material entra igual, esa
// presión desapareció — y con ella, la única razón por la que alguien miraba la
// bandeja.
//
// Es el precio de quitar un bloqueo, y hay que pagarlo con una alerta. Lo
// contrario sería cambiar un problema visible por uno invisible.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

test("sin inspecciones pendientes no se dice nada", () => {
  assert.deepEqual(senalInspeccionesPendientes(0, 0, 0), []);
});

test("pendientes sin material retenido son un aviso, no una alarma", () => {
  // Con el control en ADVIERTE nada está frenado: es trabajo acumulado del
  // laboratorio, no una planta parada.
  const [senal] = senalInspeccionesPendientes(3, 0, 0);
  assert.equal(senal.estado, "atencion");
  assert.match(senal.indicador, /3 inspecciones de entrada pendientes/);
});

test("una recepción retenida es crítica: hay materia prima parada", () => {
  const [senal] = senalInspeccionesPendientes(4, 1, 0);
  assert.equal(senal.estado, "critico");
  assert.match(senal.indicador, /1 recepción retenida esperando calidad/);
});

test("la antigüedad va en el mensaje, porque es lo que lo hace accionable", () => {
  // «2 pendientes» no dice nada. «2 pendientes, la más antigua de 45 días» sí.
  const [senal] = senalInspeccionesPendientes(2, 0, 45);
  assert.match(senal.indicador, /la más antigua, 45 días/);
});

test("sin antigüedad que reportar, el mensaje no inventa un paréntesis vacío", () => {
  const [senal] = senalInspeccionesPendientes(2, 0, 0);
  assert.doesNotMatch(senal.indicador, /\(\)/);
  assert.doesNotMatch(senal.indicador, /más antigua/);
});

test("el plural concuerda en los dos casos", () => {
  assert.match(senalInspeccionesPendientes(1, 0, 0)[0].indicador, /1 inspección de entrada pendiente/);
  assert.match(senalInspeccionesPendientes(2, 2, 0)[0].indicador, /2 recepciones retenidas/);
  assert.match(senalInspeccionesPendientes(1, 0, 1)[0].indicador, /1 día\)/);
});

// --- Que esté conectado -----------------------------------------------------

test("el aviso llega al panel general", async () => {
  // La guardia de siempre: una alerta que hay que ir a buscar no alerta.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  assert.match(panel, /senalInspeccionesPendientes\(/, "el semáforo no recibe la señal");
  assert.match(panel, /resultado: "PENDIENTE"/, "no cuenta las inspecciones de verdad");
  assert.match(panel, /stockIngresadoEnRecepcion/, "no distingue las que retienen material");
});

test("la señal NO cuelga del interruptor de calibración", async () => {
  // Una inspección de entrada sin resolver es trabajo pendiente con o sin
  // laboratorio en régimen. Colgarla del interruptor la escondería justo en la
  // empresa que todavía no encendió nada — que es donde más se olvida.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  const abre = panel.indexOf("...(avisaCalibracion");
  const cierra = panel.indexOf(": []", abre);
  assert.ok(abre !== -1 && cierra !== -1);
  assert.doesNotMatch(
    panel.slice(abre, cierra),
    /senalInspeccionesPendientes\(/,
    "el aviso de inspecciones quedó escondido detrás del interruptor"
  );
});

test("el aviso va ANTES que las homologaciones, y no por casualidad", async () => {
  // El semáforo muestra una línea por módulo y, entre señales de la misma
  // severidad, gana la primera. Detrás de las homologaciones este aviso no se
  // veía nunca — comprobado en el navegador antes de reordenarlo.
  //
  // Una inspección sin resolver es trabajo no hecho sobre material que ya está
  // en producción; una homologación vencida es documentación que dejó de
  // imprimirse. Las dos avisan; una de las dos se puede hacer hoy.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  const inspecciones = panel.indexOf("senalInspeccionesPendientes(");
  const homologaciones = panel.indexOf("senalHomologaciones(");
  assert.ok(inspecciones !== -1 && homologaciones !== -1);
  assert.ok(
    inspecciones < homologaciones,
    "las homologaciones volvieron a tapar el aviso de inspecciones pendientes"
  );
});
