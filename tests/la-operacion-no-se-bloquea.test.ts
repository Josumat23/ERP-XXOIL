import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { controlAlLiberar, controlDeRecepcion } from "@/lib/calibracion";
import { densidadAplicable } from "@/lib/densidad";

// ---------------------------------------------------------------------------
// Lo que falta desarrollar no puede frenar la operación.
//
// Principio fijado por el negocio y repetido tres veces: se puede agregar e
// integrar más adelante, pero mientras tanto la planta produce, compras
// recibe y ventas factura. Un módulo a medio construir que detiene el trabajo
// del día se termina desactivando entero, y con él se pierde también lo que sí
// funcionaba.
//
// Hasta acá el principio estaba respetado en cada punto, pero como decisiones
// sueltas: cada ciclo volvió a tomarla por su cuenta y nada impedía que el
// próximo la tomara al revés. Este archivo la junta en un solo lugar y la hace
// verificable.
//
// NO es una prueba de funcionalidad: es una prueba de que NADA de lo que sigue
// pendiente bloquea. Si alguna vez el negocio decide que algo sí debe frenar,
// lo va a hacer encendiendo un control —que existen y son explícitos—, no
// cambiando el comportamiento por omisión.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

// --- El laboratorio ---------------------------------------------------------

test("sin control encendido, liberar un lote nunca se frena", () => {
  // Aunque TODOS los instrumentos usados estén sin calibración vigente.
  const control = controlAlLiberar("NO_APLICA", ["DM-01", "VIS-01", "PEN-01"]);
  assert.equal(control.bloquea, false);
  assert.equal(control.aviso, null);
});

test("ni siquiera con el control en el nivel más exigente se frena sin motivo", () => {
  // BLOQUEA solo actúa sobre instrumentos que de verdad no tienen respaldo. Un
  // laboratorio al día no ve nunca este control.
  assert.equal(controlAlLiberar("BLOQUEA", []).bloquea, false);
});

test("el material entra a producción aunque calidad no lo haya mirado", () => {
  // El bloqueo más caro del sistema estuvo activo sin que nadie lo decidiera:
  // marcar un insumo como «requiere inspección» retenía el stock.
  assert.equal(controlDeRecepcion("ADVIERTE", true).ingresaStock, true);
  assert.equal(controlDeRecepcion("NO_APLICA", true).ingresaStock, true);
});

test("un insumo sin inspección declarada entra siempre, en cualquier nivel", () => {
  for (const nivel of ["NO_APLICA", "ADVIERTE", "BLOQUEA"] as const) {
    assert.equal(controlDeRecepcion(nivel, false).ingresaStock, true);
  }
});

// --- Los datos maestros que todavía no se cargaron --------------------------

test("un producto sin densidad no rompe: devuelve el motivo, no una excepción", () => {
  // Quien la llama decide qué hacer. La pantalla de presentaciones, por
  // ejemplo, se salta la comprobación de coherencia en vez de impedir el alta.
  const resultado = densidadAplicable({ densidadProductoKgL: null, densidadLoteKgL: null });
  assert.equal(typeof resultado, "string");
});

test("declarar el contenido en litros no se bloquea porque falte la densidad", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/presentaciones/actions.ts"),
    "utf8"
  );
  // `return null` = sin incoherencia que reportar = el alta sigue.
  assert.match(
    acciones,
    /if \(typeof densidad === "string"\) return null;/,
    "la falta de densidad volvió a impedir dar de alta una presentación"
  );
});

test("un producto sin plan de inspección se puede evaluar igual", async () => {
  // La evaluación heredada: sin plan publicado, calidad decide a mano. Exigir
  // el plan dejaría lotes sin liberar hasta que alguien cargue el catálogo.
  const formulario = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/CalidadFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /evaluación heredada/);

  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/actions.ts"),
    "utf8"
  );
  // El plan condiciona las mediciones, no la posibilidad de evaluar.
  assert.match(acciones, /if \(plan\) \{/);
});

test("un ensayo sin instrumento declarado se registra igual", async () => {
  // `null` es «no se sabe con qué se midió», que es la verdad. Exigirlo
  // frenaría el ensayo de quien todavía no cargó el maestro de instrumentos.
  const libreria = await readFile(resolve(RAIZ, "src/lib/planesCalidad.ts"), "utf8");
  assert.match(libreria, /instrumentoId: instrumentoPorId\.get\(c\.id\) \?\? c\.instrumentoId/);
  assert.doesNotMatch(libreria, /Indique el instrumento/);
});

test("un re-análisis sin plan declarado se registra igual", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/envasados/actions.ts"),
    "utf8"
  );
  // Las mediciones solo se exigen si se declaró un plan.
  assert.match(acciones, /if \(planInspeccionId\) \{/);
});

// --- Lo que nace apagado ----------------------------------------------------

test("los dos controles nacen sin frenar la operación", async () => {
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  // Calibración: ni avisa. Recepción: avisa pero deja pasar.
  assert.match(esquema, /nivelControlCalibracion\s+NivelControl\s+@default\(NO_APLICA\)/);
  assert.match(esquema, /nivelInspeccionRecepcion\s+NivelControl\s+@default\(ADVIERTE\)/);
  // Ninguno nace en BLOQUEA. Es lo contrario de lo que suele venir configurado
  // en un ERP, donde el bloqueo es el estado natural y lo primero que hace el
  // implantador es desactivarlo.
  assert.doesNotMatch(esquema, /NivelControl\s+@default\(BLOQUEA\)/);
});

test("el certificado no exige que el catálogo técnico esté cargado", async () => {
  // Sin especificaciones declaradas, la sección no se imprime y el documento
  // sale igual con sus mediciones.
  const certificado = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/certificados/[loteId]/page.tsx"),
    "utf8"
  );
  assert.match(certificado, /especificaciones\.length > 0 &&/);
  assert.match(certificado, /lote\.envasados\.length > 0 &&/);
});

test("las pantallas nuevas no exigen datos para abrirse", async () => {
  // Una pantalla que falla con el catálogo vacío es una pantalla que nadie
  // puede estrenar.
  for (const [archivo, vacio] of [
    ["src/app/(app)/produccion/calidad/reensayos/page.tsx", /medicionesEvaluadas === 0/],
    ["src/app/(app)/produccion/lotes/recall/page.tsx", /recepcionesTotales === 0 &&/],
  ] as const) {
    const pagina = await readFile(resolve(RAIZ, archivo), "utf8");
    assert.match(pagina, vacio, `${archivo} no contempla el caso sin datos`);
  }
});
