import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  EXPLICACION_NIVEL_CONTROL,
  MENSAJE_NIVEL_CONTROL,
  NIVELES_CONTROL_CALIBRACION,
  avisaAlgo,
  controlAlLiberar,
} from "@/lib/calibracion";

// ---------------------------------------------------------------------------
// Cuánto pesa el control de calibración al liberar un lote.
//
// La decisión que faltaba para cerrar el laboratorio, y que el negocio tomó el
// 2026-09-17 después de tres ciclos: no son dos opciones sino TRES. Bloquear o
// advertir no alcanzan — hace falta «no aplica» para que el proceso siga su
// curso mientras el laboratorio se implementa.
//
// El fondo del asunto: por omisión NO frena. Un control de calidad que detiene
// la producción el día que alguien olvidó cargar un certificado no se usa; se
// apaga, y con él se apaga todo lo demás.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

// --- Los tres niveles -------------------------------------------------------

test("son exactamente tres, de menos a más exigente", () => {
  assert.deepEqual(NIVELES_CONTROL_CALIBRACION, ["NO_APLICA", "ADVIERTE", "BLOQUEA"]);
});

test("cada nivel se nombra y se explica en palabras", () => {
  for (const nivel of NIVELES_CONTROL_CALIBRACION) {
    assert.ok(MENSAJE_NIVEL_CONTROL[nivel], `falta el nombre de ${nivel}`);
    assert.ok(
      EXPLICACION_NIVEL_CONTROL[nivel].length > 40,
      `${nivel} no explica qué hace; un control que nadie entiende se deja en el que menos moleste`
    );
  }
});

test("solo NO_APLICA apaga el semáforo", () => {
  assert.equal(avisaAlgo("NO_APLICA"), false);
  assert.equal(avisaAlgo("ADVIERTE"), true);
  assert.equal(avisaAlgo("BLOQUEA"), true);
});

// --- Qué hace cada uno al liberar -------------------------------------------

test("sin instrumentos en falta no pasa nada, en ningún nivel", () => {
  // El control no inventa problemas donde no los hay. Ni siquiera BLOQUEA.
  for (const nivel of NIVELES_CONTROL_CALIBRACION) {
    assert.deepEqual(controlAlLiberar(nivel, []), { bloquea: false, aviso: null });
  }
});

test("NO_APLICA deja pasar y no dice nada, aunque falten calibraciones", () => {
  // Es el punto de la tercera opción: que el proceso continúe.
  assert.deepEqual(controlAlLiberar("NO_APLICA", ["DM-01", "VIS-02"]), {
    bloquea: false,
    aviso: null,
  });
});

test("ADVIERTE avisa y deja pasar", () => {
  const control = controlAlLiberar("ADVIERTE", ["DM-01"]);
  assert.equal(control.bloquea, false);
  assert.match(control.aviso ?? "", /DM-01/);
  assert.match(control.aviso ?? "", /se libera igual/);
  // Y dice a dónde va a parar el lote, para que no se pierda de vista.
  assert.match(control.aviso ?? "", /reensayar/);
});

test("BLOQUEA no deja pasar", () => {
  const control = controlAlLiberar("BLOQUEA", ["DM-01"]);
  assert.equal(control.bloquea, true);
  assert.match(control.aviso ?? "", /DM-01/);
});

test("el mensaje de BLOQUEA dice qué hacer, no solo que no se puede", () => {
  // Quien libera un lote a las 11 de la noche necesita saber si esto se
  // resuelve cargando un certificado o si hay que llamar a alguien.
  const aviso = controlAlLiberar("BLOQUEA", ["DM-01"]).aviso ?? "";
  assert.match(aviso, /Cargue la calibración/);
  assert.match(aviso, /ADVIERTE/);
});

test("con varios instrumentos los nombra a todos y concuerda el plural", () => {
  const uno = controlAlLiberar("ADVIERTE", ["DM-01"]).aviso ?? "";
  const varios = controlAlLiberar("ADVIERTE", ["DM-01", "VIS-02"]).aviso ?? "";
  assert.match(uno, /El instrumento DM-01 no tiene/);
  assert.match(varios, /Los instrumentos DM-01, VIS-02 no tienen/);
});

// --- Que esté conectado -----------------------------------------------------

test("el servidor decide el bloqueo, no el formulario", async () => {
  // El formulario avisa antes, que es cuando sirve; pero la decisión de
  // bloquear es de la compañía y se lee de su configuración, no de lo que
  // mande el navegador.
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /controlAlLiberar\(/, "la acción no aplica el control");
  assert.match(
    acciones,
    /configuracionEmpresa\.findUnique\([\s\S]{0,160}nivelControlCalibracion/,
    "el nivel no se lee de la configuración de la compañía"
  );
  assert.match(acciones, /politica\.bloquea/, "no frena cuando corresponde");
});

test("el formulario avisa ANTES de liberar", async () => {
  const formulario = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/CalidadFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /controlAlLiberar\(/);
  assert.match(formulario, /control\.bloquea/, "no desactiva el botón al bloquear");
});

test("la pantalla de instrumentos ofrece los tres niveles", async () => {
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/instrumentos/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /NIVELES_CONTROL_CALIBRACION\.map/, "no ofrece los tres");
  assert.match(pagina, /fijarNivelControlCalibracion\(/);
  assert.match(pagina, /EXPLICACION_NIVEL_CONTROL/, "no explica qué hace cada uno");
});

test("el interruptor viejo ya no existe en ningún lado", async () => {
  // Dos fuentes para el mismo hecho terminan discrepando: el booleano se
  // reemplazó, no convive con el nivel.
  for (const archivo of [
    "src/app/(app)/page.tsx",
    "src/app/(app)/produccion/calidad/instrumentos/page.tsx",
    "src/app/(app)/produccion/calidad/instrumentos/actions.ts",
  ]) {
    const texto = await readFile(resolve(RAIZ, archivo), "utf8");
    assert.doesNotMatch(texto, /\bcontrolCalibracion\b/, `${archivo} sigue usando el booleano`);
  }
});

// --- Contra la base ---------------------------------------------------------

test("la compañía nace en NO_APLICA: el laboratorio no frena por omisión", async () => {
  const configuracion = await prisma.configuracionEmpresa.findFirst({ where: { empresaId: "1" } });
  assert.ok(configuracion);
  assert.equal(configuracion.nivelControlCalibracion, "NO_APLICA");
});

test("BLOQUEA impide liberar, NO_APLICA deja, y el lote no se toca en el intento", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `NIV-${sufijo}`, nombre: `Grasa ${sufijo}` },
  });
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId, codigo: `SIN-CAL-${sufijo}`, nombre: "Densímetro sin calibrar" },
  });
  const formula = await prisma.formula.create({
    data: { empresaId, productoId: producto.id, version: 1, rendimientoKg: 100, usuarioId: "u", usuarioNombre: "u" },
  });
  const lote = await prisma.loteGranel.create({
    data: {
      empresaId,
      codigo: `LG-NIV-${sufijo}`,
      formulaId: formula.id,
      kgObjetivo: 100,
      kgProducidos: 100,
      estado: "PENDIENTE_CALIDAD",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  try {
    // El instrumento no tiene ninguna calibración: su medición no se sostiene.
    const sinRespaldo = [instrumento.codigo];

    assert.equal(controlAlLiberar("BLOQUEA", sinRespaldo).bloquea, true);
    assert.equal(controlAlLiberar("ADVIERTE", sinRespaldo).bloquea, false);
    assert.equal(controlAlLiberar("NO_APLICA", sinRespaldo).bloquea, false);

    // Y el lote sigue pendiente: evaluar el control no cambia nada por sí solo.
    const despues = await prisma.loteGranel.findUniqueOrThrow({ where: { id: lote.id } });
    assert.equal(despues.estado, "PENDIENTE_CALIDAD");
  } finally {
    await prisma.loteGranel.delete({ where: { id: lote.id } }).catch(() => {});
    await prisma.formula.delete({ where: { id: formula.id } }).catch(() => {});
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
  }
});

test("el nivel se guarda y se lee tal cual", async () => {
  const antes = await prisma.configuracionEmpresa.findFirstOrThrow({ where: { empresaId: "1" } });
  try {
    for (const nivel of NIVELES_CONTROL_CALIBRACION) {
      await prisma.configuracionEmpresa.update({
        where: { empresaId: "1" },
        data: { nivelControlCalibracion: nivel },
      });
      const leido = await prisma.configuracionEmpresa.findFirstOrThrow({ where: { empresaId: "1" } });
      assert.equal(leido.nivelControlCalibracion, nivel);
    }
  } finally {
    await prisma.configuracionEmpresa.update({
      where: { empresaId: "1" },
      data: { nivelControlCalibracion: antes.nivelControlCalibracion },
    });
  }
});
