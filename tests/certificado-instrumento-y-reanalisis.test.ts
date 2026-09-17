import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Qué dice el certificado de análisis que va al cliente.
//
// Dos cosas que el sistema sabía y el documento callaba:
//
// 1. Con qué EQUIPO se midió cada característica.
// 2. Que la vigencia de un envase fue REVALIDADA por un re-ensayo.
//
// La segunda es la que importa. Un lubricante no se echa a perder al llegar su
// fecha: el laboratorio lo vuelve a ensayar y le da vigencia nueva. Quien
// recibe producto con la fecha extendida tiene derecho a ver que la extensión
// se sostiene en un ensayo y no en una decisión administrativa — que es,
// exactamente, la diferencia entre revalidar y reetiquetar.
//
// Lo decidió el negocio el 2026-09-18; hasta entonces el certificado no lo
// mencionaba y esta guarda no existía.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const CERTIFICADO = "src/app/(app)/produccion/calidad/certificados/[loteId]/page.tsx";

test("el certificado imprime el equipo con el que se midió", async () => {
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.match(pagina, /instrumento: \{ select: \{ codigo: true, nombre: true \} \}/);
  assert.match(pagina, /Método \/ equipo/, "la columna no anuncia que trae el equipo");
});

test("NO imprime si la calibración estaba vigente", async () => {
  // El equipo es un hecho del ensayo. Si su calibración se sostenía es algo
  // que el sistema DERIVA del historial, y afirmarlo —o negarlo— en un
  // documento que va al cliente es criterio de calidad, no un dato.
  //
  // El sistema ya lo dice donde corresponde: en «Qué hay que reensayar».
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.doesNotMatch(pagina, /respaldoDeMedicion/);
  assert.doesNotMatch(pagina, /MENSAJE_RESPALDO/);
});

test("el certificado declara la revalidación de vigencia", async () => {
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.match(pagina, /Revalidación de vigencia/);
  assert.match(pagina, /vencimientoAnterior/, "no muestra de qué fecha venía");
  assert.match(pagina, /vencimientoNuevo/, "no muestra a qué fecha pasó");
});

test("dice de qué ENVASE habla cada revalidación", async () => {
  // El certificado es del lote y los re-análisis son de cada envasado: un lote
  // puede tener varios envases y solo algunos revalidados. Sin el código del
  // envase, quien recibe el EV-00003 leería la revalidación de otro.
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.match(pagina, /<th>Envase<\/th>/);
  assert.match(pagina, /reanalisis: \{ some: \{\} \}/, "trae envasados sin re-análisis");
});

test("un re-ensayo rechazado también se imprime", async () => {
  // Imprimir solo los aprobados sería elegir qué parte de la historia se
  // cuenta. Un RECHAZADO no extiende la vigencia —eso lo impide el registro—
  // pero consta que se ensayó.
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.doesNotMatch(
    pagina,
    /reanalisis: \{[^}]*resultado: "APROBADO"/,
    "filtra los re-análisis rechazados"
  );
  assert.match(pagina, /RECHAZADO no extiende la vigencia/);
});

test("la sección no aparece si el lote no tiene revalidaciones", async () => {
  // Un encabezado con una tabla vacía en un documento impreso hace dudar de si
  // falta información.
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.match(pagina, /lote\.envasados\.length > 0 &&/);
});

test("las mediciones del re-ensayo van con su equipo, como las de liberación", async () => {
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.match(pagina, /Mediciones del re-ensayo/);
  assert.match(pagina, /m\.instrumento \? ` · \$\{m\.instrumento\.codigo\}` : ""/);
});

test("sigue sin imprimir una homologación vencida", async () => {
  // Guarda de un ciclo anterior: el documento se emite HOY y afirmar hoy una
  // homologación que dejó de regir sería afirmar algo que no es cierto. Se
  // repite acá porque este ciclo tocó el mismo archivo.
  const pagina = await readFile(resolve(RAIZ, CERTIFICADO), "utf8");
  assert.match(pagina, /declaracionesParaDocumento\(/);
});
