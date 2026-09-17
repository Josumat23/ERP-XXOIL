import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  plural,
  senalCalibraciones,
  senalEquivalencias,
  senalHomologaciones,
  senalMasSevera,
  type SenalSemaforo,
} from "@/lib/semaforo";

// ---------------------------------------------------------------------------
// Que el semáforo cargue toda la evidencia que caducó, no solo una parte.
//
// Tres ciclos seguidos terminaron con la misma frase escrita en su
// documentación: «el aviso sigue siendo pasivo». Una homologación por vencer se
// veía en rojo en la ficha del producto; una equivalencia degradada, en la
// ficha del competidor; una calibración vencida, en la del instrumento. Las
// tres solo para quien abría esa pantalla.
//
// Es la misma forma en los tres casos: algo que se afirmó con respaldo, y el
// respaldo caducó sin que nadie tocara la afirmación. Construir la degradación
// automática y después esconderla detrás de una pantalla que hay que acordarse
// de abrir deja el trabajo a mitad de camino.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

// --- Elegir qué se muestra --------------------------------------------------

test("sin señales, el módulo está bien y lo dice con su propia frase", () => {
  assert.deepEqual(senalMasSevera([], "Sin evidencia vencida"), {
    indicador: "Sin evidencia vencida",
    estado: "bien",
  });
});

test("gana la más severa, esté donde esté en la lista", () => {
  const senales: SenalSemaforo[] = [
    { indicador: "aviso", estado: "atencion" },
    { indicador: "grave", estado: "critico" },
    { indicador: "otro aviso", estado: "atencion" },
  ];
  assert.equal(senalMasSevera(senales, "—").indicador, "grave");
  // Y da igual el orden: la severidad manda sobre la posición.
  assert.equal(senalMasSevera([...senales].reverse(), "—").indicador, "grave");
});

test("entre iguales gana la primera, y eso lo decide quien arma la lista", () => {
  // La decisión queda a la vista en el orden, en vez de escondida en un
  // ternario anidado.
  const senales: SenalSemaforo[] = [
    { indicador: "primera", estado: "atencion" },
    { indicador: "segunda", estado: "atencion" },
  ];
  assert.equal(senalMasSevera(senales, "—").indicador, "primera");
});

test("una sola señal «bien» no se confunde con no tener señales", () => {
  assert.equal(senalMasSevera([{ indicador: "todo en orden", estado: "bien" }], "vacío").indicador, "todo en orden");
});

// --- Cómo se redacta --------------------------------------------------------

test("el plural se escribe, no se resuelve con «(s)»", () => {
  assert.equal(plural(1, "instrumento", "instrumentos"), "1 instrumento");
  assert.equal(plural(3, "instrumento", "instrumentos"), "3 instrumentos");
  assert.equal(plural(0, "instrumento", "instrumentos"), "0 instrumentos");
});

// --- Las tres fuentes -------------------------------------------------------

test("una calibración sin vigencia es crítica; uno por vencer, aviso", () => {
  // Lo que mida un instrumento vencido o fuera de tolerancia no se sostiene:
  // no puede liberar un lote. Eso no es un recordatorio.
  const criticas = senalCalibraciones(2, 0);
  assert.equal(criticas[0].estado, "critico");
  assert.match(criticas[0].indicador, /2 instrumentos sin calibración vigente/);

  const porVencer = senalCalibraciones(0, 1);
  assert.equal(porVencer[0].estado, "atencion");
  assert.match(porVencer[0].indicador, /1 instrumento por calibrar/);

  assert.deepEqual(senalCalibraciones(0, 0), [], "sin nada que decir, no ocupa la fila");
});

test("una homologación vencida es aviso, no crítico", () => {
  // No rompe nada: el certificado ya dejó de imprimirla y la cobertura ya bajó
  // sola. Lo que hace falta es renovarla.
  const senales = senalHomologaciones(1, 0);
  assert.equal(senales[0].estado, "atencion");
  assert.match(senales[0].indicador, /1 homologación vencida/);
  assert.match(senalHomologaciones(0, 2)[0].indicador, /2 homologaciones por vencer/);
  assert.deepEqual(senalHomologaciones(0, 0), []);
});

test("las dos señales de homologación conviven, y la vencida va primero", () => {
  const senales = senalHomologaciones(1, 3);
  assert.equal(senales.length, 2);
  assert.match(senales[0].indicador, /vencida/);
});

test("una equivalencia degradada dice que hoy cubre menos que al declararla", () => {
  // Es una afirmación comercial desactualizada: se sigue ofreciendo un
  // reemplazo cuya evidencia se debilitó.
  const senales = senalEquivalencias(2);
  assert.equal(senales[0].estado, "atencion");
  assert.match(senales[0].indicador, /2 equivalencias que cubren menos que al declararla/);
  assert.deepEqual(senalEquivalencias(0), []);
});

// --- Guardias estructurales -------------------------------------------------

test("el panel carga las tres fuentes, no solo la calibración", async () => {
  // El ciclo anterior dejó la fila de Calidad mirando un único origen. Esta
  // guardia falla si alguna de las otras dos vuelve a quedar fuera.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  assert.match(panel, /senalCalibraciones\(/, "falta la calibración");
  assert.match(panel, /senalHomologaciones\(/, "faltan las homologaciones");
  assert.match(panel, /senalEquivalencias\(/, "faltan las equivalencias");
  // Y las calcula de verdad, no con un cero fijo.
  assert.match(panel, /cambioDeCobertura\(/, "no detecta la equivalencia degradada");
  assert.match(panel, /declaracionesParaDocumento\(/, "no distingue la homologación vencida");
});

test("Calidad es una fila permanente y no depende del interruptor", async () => {
  // Las homologaciones no tienen nada que ver con el control de calibración:
  // si la fila entera colgara del interruptor, quedarían invisibles con el
  // laboratorio todavía apagado.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  assert.doesNotMatch(
    panel,
    /\.\.\.\(controlCalibracion\s*\?\s*\[\s*\{\s*modulo: "Calidad"/,
    "la fila de Calidad volvió a colgar del interruptor"
  );
  assert.match(panel, /modulo: "Calidad"/);
  // Pero la señal de calibración sí sigue dependiendo de él.
  assert.match(
    panel,
    /\.\.\.\(controlCalibracion[\s\S]{0,80}senalCalibraciones\(/,
    "la calibración dejó de respetar el interruptor"
  );
});

test("la severidad no se decide con ternarios anidados en la pantalla", async () => {
  // El motivo de extraer esto: cada fuente nueva agregaba un nivel de anidado,
  // y la regla quedaba repetida en cada fila.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  assert.match(panel, /senalMasSevera\(/);
});
