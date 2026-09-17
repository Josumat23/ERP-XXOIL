import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  DIAS_DE_AVISO_CALIBRACION,
  MENSAJE_ERROR_CALIBRACION,
  calibracionVigente,
  estadoCalibracion,
  proximaCalibracionSugerida,
  requiereAtencion,
  resumenParaSemaforo,
  validarCalibracion,
} from "@/lib/calibracion";

// ---------------------------------------------------------------------------
// Calibración de los instrumentos del laboratorio.
//
// El negocio confirmó el 2026-09-17 que el laboratorio está en implementación.
// Hasta entonces el ítem estaba en la Oleada 3 esperando exactamente ese
// disparador, y la norma del repositorio es no construirla sin él.
//
// Importa más que en otros rubros por algo concreto: desde el ciclo de la
// densidad, el densímetro produce el número que convierte kg en litros en cada
// comprobante. Una medición con un instrumento descalibrado no se queda en el
// laboratorio — llega a la factura.
//
// La vigencia sale del CERTIFICADO, no de «última calibración + frecuencia».
// Calcularla es como los sistemas terminan afirmando una vigencia que discrepa
// en silencio con el papel que firmó quien calibró.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const HOY = new Date(2026, 8, 17);
const enDias = (n: number) => new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);
const cal = (fecha: Date, vigenteHasta: Date, resultado: "CONFORME" | "CONFORME_CON_AJUSTE" | "NO_CONFORME" = "CONFORME") =>
  ({ fecha, vigenteHasta, resultado }) as const;

// --- Cuál calibración rige --------------------------------------------------

test("rige la más reciente por fecha, no la última cargada", () => {
  // El historial se carga en cualquier orden al poner el laboratorio en marcha.
  const vigente = calibracionVigente([
    cal(enDias(-400), enDias(-35)),
    cal(enDias(-30), enDias(335)),
    cal(enDias(-700), enDias(-335)),
  ]);
  assert.equal(vigente?.vigenteHasta.getTime(), enDias(335).getTime());
});

test("sin calibraciones no hay ninguna vigente", () => {
  assert.equal(calibracionVigente([]), null);
});

// --- El estado de hoy -------------------------------------------------------

test("un instrumento sin calibrar se distingue de uno vencido", () => {
  // No es lo mismo «nunca se calibró» que «se calibró y caducó»: la primera es
  // un instrumento que nunca debió usarse, la segunda una fecha que se pasó.
  assert.equal(estadoCalibracion([], HOY), "SIN_CALIBRAR");
  assert.equal(estadoCalibracion([cal(enDias(-400), enDias(-1))], HOY), "VENCIDA");
});

test("fuera de tolerancia gana sobre la fecha", () => {
  // LA regla. Un instrumento que volvió NO_CONFORME no mide bien aunque su
  // certificado siga vigente — y por eso son dos estados y no uno: vencido es
  // «no se sabe», no conforme es «se sabe que no».
  assert.equal(
    estadoCalibracion([cal(enDias(-10), enDias(355), "NO_CONFORME")], HOY),
    "NO_CONFORME"
  );
});

test("conforme con ajuste sigue sirviendo", () => {
  // Volvió dentro de tolerancia después de ajustarlo: es un instrumento usable.
  assert.equal(
    estadoCalibracion([cal(enDias(-10), enDias(355), "CONFORME_CON_AJUSTE")], HOY),
    "VIGENTE"
  );
});

test("se avisa antes de vencer, porque calibrar toma semanas", () => {
  assert.equal(estadoCalibracion([cal(enDias(-300), enDias(60))], HOY), "VIGENTE");
  assert.equal(
    estadoCalibracion([cal(enDias(-300), enDias(DIAS_DE_AVISO_CALIBRACION - 1))], HOY),
    "POR_VENCER"
  );
  // El día del vencimiento todavía rige: vence ese día, no antes.
  assert.equal(estadoCalibracion([cal(enDias(-300), HOY)], HOY), "POR_VENCER");
});

test("los tres estados que impiden liberar un lote", () => {
  assert.equal(requiereAtencion("VENCIDA"), true);
  assert.equal(requiereAtencion("NO_CONFORME"), true);
  assert.equal(requiereAtencion("SIN_CALIBRAR"), true);
  assert.equal(requiereAtencion("POR_VENCER"), false, "por vencer todavía sirve");
  assert.equal(requiereAtencion("VIGENTE"), false);
});

// --- Registrar una calibración ---------------------------------------------

const valida = {
  fecha: enDias(-1),
  vigenteHasta: enDias(364),
  numeroCertificado: "CAL-2026-001",
  entidad: "Laboratorio acreditado",
};

test("una calibración coherente se acepta", () => {
  assert.equal(validarCalibracion(valida, HOY), null);
});

test("sin certificado no hay cómo rastrearla", () => {
  assert.equal(
    validarCalibracion({ ...valida, numeroCertificado: "  " }, HOY),
    "SIN_CERTIFICADO"
  );
});

test("sin emisor el certificado no se puede verificar", () => {
  assert.equal(validarCalibracion({ ...valida, entidad: "" }, HOY), "SIN_ENTIDAD");
});

test("no se registra una calibración que todavía no ocurrió", () => {
  // Dejaría el instrumento como calibrado antes de estarlo.
  assert.equal(
    validarCalibracion({ ...valida, fecha: enDias(1) }, HOY),
    "FECHA_EN_EL_FUTURO"
  );
  // Hoy sí: se registra el mismo día que se hizo.
  assert.equal(validarCalibracion({ ...valida, fecha: HOY }, HOY), null);
});

test("la vigencia no puede terminar antes de la calibración", () => {
  assert.equal(
    validarCalibracion({ ...valida, fecha: enDias(-1), vigenteHasta: enDias(-10) }, HOY),
    "VIGENCIA_ANTES_DE_LA_FECHA"
  );
});

test("cada error dice qué hacer, no solo que está mal", () => {
  assert.match(MENSAJE_ERROR_CALIBRACION.SIN_CERTIFICADO, /número/);
  assert.match(MENSAJE_ERROR_CALIBRACION.SIN_ENTIDAD, /quién realizó/);
});

// --- La frecuencia es una sugerencia ---------------------------------------

test("la próxima fecha se sugiere desde la frecuencia, y sin frecuencia no se inventa", () => {
  assert.deepEqual(proximaCalibracionSugerida(HOY, 365), enDias(365));
  assert.equal(proximaCalibracionSugerida(HOY, null), null);
  assert.equal(proximaCalibracionSugerida(HOY, 0), null);
  assert.equal(proximaCalibracionSugerida(HOY, -30), null);
});

// --- El aviso activo --------------------------------------------------------

test("el resumen separa lo que impide trabajar de lo que hay que agendar", () => {
  const resumen = resumenParaSemaforo([
    "VIGENTE",
    "POR_VENCER",
    "VENCIDA",
    "NO_CONFORME",
    "SIN_CALIBRAR",
  ]);
  assert.equal(resumen.criticos, 3);
  assert.equal(resumen.porVencer, 1);
});

// --- Guardias estructurales -------------------------------------------------

test("el control nace apagado", async () => {
  // El laboratorio está en implementación: exigirlo o alertar sobre él antes de
  // que exista sería ruido. Lo pidió el negocio explícitamente.
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  // Ya no es un booleano sino tres niveles (decisión del negocio 2026-09-17),
  // pero la propiedad que importa es la misma: nace sin frenar ni avisar.
  assert.match(esquema, /nivelControlCalibracion\s+NivelControlCalibracion\s+@default\(NO_APLICA\)/);
});

test("la vigencia se guarda, no se calcula desde la frecuencia", async () => {
  // Un sistema que la calcula termina afirmando una vigencia que discrepa con
  // el certificado. La frecuencia es opcional justamente porque no manda.
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model CalibracionInstrumento {"),
    esquema.indexOf("\n}", esquema.indexOf("model CalibracionInstrumento {"))
  );
  assert.ok(modelo.length > 200, "el corte quedó vacío");
  assert.match(modelo, /vigenteHasta\s+DateTime/);
  assert.match(modelo, /numeroCertificado\s+String/);
  assert.match(modelo, /entidad\s+String/);
  assert.match(modelo, /usuarioId\s+String/);

  const instrumento = esquema.slice(
    esquema.indexOf("model InstrumentoMedicion {"),
    esquema.indexOf("\n}", esquema.indexOf("model InstrumentoMedicion {"))
  );
  assert.match(
    instrumento,
    /frecuenciaCalibracionDias\s+Int\?/,
    "la frecuencia debería ser opcional: es una ayuda, no la regla"
  );
});

test("el aviso llega al panel general y no se queda en su pantalla", async () => {
  // Es el defecto que quedó anotado dos veces —homologaciones por vencer,
  // equivalencias degradadas—: una alerta que hay que ir a buscar no alerta.
  const panel = await readFile(resolve(RAIZ, "src/app/(app)/page.tsx"), "utf8");
  assert.match(panel, /resumenParaSemaforo\(/, "el panel no resume las calibraciones");
  assert.match(panel, /modulo: "Calidad"/, "no hay fila de Calidad en el semáforo");
  // Y solo cuando el control está encendido.
  // La SEÑAL de calibración cuelga del interruptor. La fila de Calidad ya no:
  // desde que también lleva las homologaciones —que no tienen nada que ver con
  // el laboratorio— colgarla entera dejaría esas invisibles.
  //
  // Se comprueba por estructura, no por cercanía de texto: exigir que
  // `senalCalibraciones` apareciera a menos de 80 caracteres del interruptor
  // hacía fallar la prueba cada vez que otra señal se sumaba al mismo bloque,
  // que es exactamente lo que había que dejar pasar.
  const abre = panel.indexOf("...(avisaCalibracion");
  assert.notEqual(abre, -1, "la calibración no depende del interruptor");
  const cierra = panel.indexOf(": []", abre);
  assert.notEqual(cierra, -1, "el bloque del interruptor no cierra en una lista vacía");
  assert.match(
    panel.slice(abre, cierra),
    /senalCalibraciones\(/,
    "la calibración no depende del interruptor"
  );
  assert.match(panel, /"critico"/, "un instrumento sin calibración vigente no es solo un aviso");
});

test("la acción valida con la librería y no confía en el id del formulario", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/instrumentos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /export async function registrarCalibracion/);
  assert.match(acciones, /validarCalibracion\(/, "no usa la validación compartida");
  assert.match(acciones, /instrumentoMedicion\.findFirst\(\{[\s\S]{0,80}empresaId/);
  // El interruptor también es una escritura: pasa por permisos.
  assert.match(acciones, /export async function fijarNivelControlCalibracion/);
  assert.match(acciones, /puedeRealizar\(auth\.usuario, "produccion", "editar"\)/);
});

test("se puede cargar y calibrar desde pantalla, y la pantalla está en el menú", async () => {
  const instrumento = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/instrumentos/InstrumentoFormulario.tsx"),
    "utf8"
  );
  for (const campo of ["codigo", "nombre", "marca", "serie", "frecuenciaCalibracionDias"]) {
    assert.match(instrumento, new RegExp(`name="${campo}"`), `falta el campo ${campo}`);
  }
  const calibracion = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/instrumentos/CalibracionFormulario.tsx"),
    "utf8"
  );
  for (const campo of ["fecha", "vigenteHasta", "resultado", "numeroCertificado", "entidad"]) {
    assert.match(calibracion, new RegExp(`name="${campo}"`), `falta el campo ${campo}`);
  }
  const navegacion = await readFile(resolve(RAIZ, "src/lib/navegacion.ts"), "utf8");
  assert.match(navegacion, /\/produccion\/calidad\/instrumentos/);
});

// --- Contra la base ---------------------------------------------------------

test("el historial es un ledger y el estado sale de la más reciente", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const instrumento = await prisma.instrumentoMedicion.create({
    data: {
      empresaId,
      codigo: `DM-${sufijo}`,
      nombre: "Densímetro digital",
      frecuenciaCalibracionDias: 365,
    },
  });

  try {
    // Se carga el historial DESORDENADO a propósito: al poner el laboratorio en
    // marcha nadie carga las calibraciones viejas en orden.
    const base = Date.now();
    const dia = 24 * 60 * 60 * 1000;
    for (const [diasAtras, diasVigencia, resultado] of [
      [400, 35, "CONFORME"],
      [30, 335, "CONFORME"],
      [800, -435, "CONFORME"],
    ] as const) {
      await prisma.calibracionInstrumento.create({
        data: {
          empresaId,
          instrumentoId: instrumento.id,
          fecha: new Date(base - diasAtras * dia),
          vigenteHasta: new Date(base - diasAtras * dia + diasVigencia * dia),
          resultado,
          numeroCertificado: `CAL-${diasAtras}`,
          entidad: "Laboratorio acreditado",
          usuarioId: "u",
          usuarioNombre: "u",
        },
      });
    }

    const leido = await prisma.instrumentoMedicion.findUniqueOrThrow({
      where: { id: instrumento.id },
      include: { calibraciones: true },
    });
    const vigente = calibracionVigente(leido.calibraciones);
    assert.equal(vigente?.numeroCertificado, "CAL-30", "no tomó la más reciente");
    // 30 días atrás + 335 de vigencia = todavía rige.
    assert.equal(estadoCalibracion(leido.calibraciones), "VIGENTE");

    // Una calibración nueva que vuelve fuera de tolerancia deja el instrumento
    // inutilizable sin borrar nada del historial.
    await prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(base - dia),
        vigenteHasta: new Date(base + 300 * dia),
        resultado: "NO_CONFORME",
        numeroCertificado: "CAL-HOY",
        entidad: "Laboratorio acreditado",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const despues = await prisma.instrumentoMedicion.findUniqueOrThrow({
      where: { id: instrumento.id },
      include: { calibraciones: true },
    });
    assert.equal(estadoCalibracion(despues.calibraciones), "NO_CONFORME");
    assert.equal(despues.calibraciones.length, 4, "el historial no se toca");
  } finally {
    await prisma.calibracionInstrumento.deleteMany({ where: { instrumentoId: instrumento.id } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
  }
});

test("borrar el instrumento se lleva su historial, y el código es único por compañía", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId, codigo: `VS-${sufijo}`, nombre: "Viscosímetro" },
  });
  try {
    await assert.rejects(
      prisma.instrumentoMedicion.create({
        data: { empresaId, codigo: `VS-${sufijo}`, nombre: "Otro" },
      })
    );
    await prisma.calibracionInstrumento.create({
      data: {
        empresaId,
        instrumentoId: instrumento.id,
        fecha: new Date(),
        vigenteHasta: new Date(Date.now() + 86400000),
        resultado: "CONFORME",
        numeroCertificado: "X",
        entidad: "Y",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } });
    assert.equal(
      await prisma.calibracionInstrumento.count({ where: { instrumentoId: instrumento.id } }),
      0
    );
  } finally {
    await prisma.calibracionInstrumento.deleteMany({ where: { instrumentoId: instrumento.id } });
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
  }
});
