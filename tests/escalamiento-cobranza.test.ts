import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  accionDeCobranza,
  nivelPorAntiguedad,
  validarPolitica,
  type AvisoParaEscalar,
  type PoliticaEscalamiento,
} from "@/lib/escalamientoCobranza";

// El escalamiento dice QUÉ corresponde hoy y POR QUÉ. No emite el aviso: en
// este sistema registrar un aviso deja constancia de que alguien contactó al
// cliente, y esa llamada la hace una persona.

const HOY = new Date(2026, 8, 12); // 12 de setiembre de 2026, hora local
const dia = (mes: number, d: number) => new Date(2026, mes, d);

/** Política con las dos reglas opcionales apagadas. */
const BASE: PoliticaEscalamiento = {
  diasNivel2: 15,
  diasNivel3: 30,
  diasSinRespuesta: null,
  diasGraciaCompromiso: null,
  pausarEnDisputa: true,
};

const aviso = (parcial: Partial<AvisoParaEscalar> = {}): AvisoParaEscalar => ({
  nivel: 1,
  fecha: dia(8, 1),
  estado: "PENDIENTE",
  compromisoPagoEn: null,
  ...parcial,
});

test("los umbrales por defecto son los que el sistema ya usaba", () => {
  // 15 y 30 vivían fijos en el código. Definir la política no cambia, por sí
  // solo, el nivel que se venía sugiriendo.
  assert.equal(nivelPorAntiguedad(1), 1);
  assert.equal(nivelPorAntiguedad(15), 1);
  assert.equal(nivelPorAntiguedad(16), 2);
  assert.equal(nivelPorAntiguedad(30), 2);
  assert.equal(nivelPorAntiguedad(31), 3);
  // Y con umbrales propios manda la política.
  assert.equal(nivelPorAntiguedad(16, 20, 40), 1);
  assert.equal(nivelPorAntiguedad(41, 20, 40), 3);
});

test("un compromiso vigente pausa, por vencida que esté la factura", () => {
  // Perseguir a alguien el día después de que quedó en pagar el viernes es la
  // forma más rápida de perder el compromiso.
  const accion = accionDeCobranza(
    120,
    aviso({ estado: "COMPROMISO_PAGO", compromisoPagoEn: dia(8, 20) }),
    { ...BASE, diasSinRespuesta: 5, diasGraciaCompromiso: 3 },
    HOY
  );
  assert.equal(accion.tipo, "PAUSADA");
  assert.match(accion.motivo, /se comprometió a pagar/);
});

test("un compromiso para HOY todavía no se incumple", () => {
  const accion = accionDeCobranza(
    60,
    aviso({ estado: "COMPROMISO_PAGO", compromisoPagoEn: HOY }),
    BASE,
    HOY
  );
  assert.equal(accion.tipo, "PAUSADA");
});

test("un compromiso SIN fecha no congela la cobranza", () => {
  // Si bastara el estado, guardar un compromiso vacío sería la forma de
  // frenar el escalamiento de una factura para siempre.
  const accion = accionDeCobranza(
    90,
    aviso({ nivel: 1, estado: "COMPROMISO_PAGO", compromisoPagoEn: null }),
    { ...BASE, diasGraciaCompromiso: 1 },
    HOY
  );
  assert.equal(accion.tipo, "AVISO_DEBIDO");
  assert.equal(accion.nivel, 3);
});

test("la disputa pausa solo si la política lo dice", () => {
  const enDisputa = aviso({ nivel: 1, estado: "EN_DISPUTA" });
  assert.equal(accionDeCobranza(90, enDisputa, BASE, HOY).tipo, "PAUSADA");

  const sinPausa = accionDeCobranza(90, enDisputa, { ...BASE, pausarEnDisputa: false }, HOY);
  assert.equal(sinPausa.tipo, "AVISO_DEBIDO");
});

test("una factura vencida sin ningún aviso siempre debe uno", () => {
  const accion = accionDeCobranza(40, null, BASE, HOY);
  assert.equal(accion.tipo, "AVISO_DEBIDO");
  assert.equal(accion.nivel, 3);
  assert.match(accion.motivo, /sin ningún aviso/);
});

test("una regla en null NO corre", () => {
  // Definir la política no enciende las reglas opcionales: cada una es una
  // decisión propia del negocio.
  const viejoSinRespuesta = aviso({ nivel: 2, fecha: dia(6, 1), estado: "SIN_RESPUESTA" });
  assert.equal(accionDeCobranza(20, viejoSinRespuesta, BASE, HOY).tipo, "AL_DIA");

  const conRegla = accionDeCobranza(20, viejoSinRespuesta, { ...BASE, diasSinRespuesta: 7 }, HOY);
  assert.equal(conRegla.tipo, "AVISO_DEBIDO");
  assert.equal(conRegla.nivel, 3);
});

test("un aviso sin respuesta escala al cumplirse el plazo, no antes", () => {
  const hace5 = aviso({ nivel: 1, fecha: dia(8, 7), estado: "PENDIENTE" });
  const politica = { ...BASE, diasSinRespuesta: 5 };
  assert.equal(accionDeCobranza(10, hace5, politica, HOY).tipo, "AVISO_DEBIDO");

  const hace4 = aviso({ nivel: 1, fecha: dia(8, 8), estado: "PENDIENTE" });
  assert.equal(accionDeCobranza(10, hace4, politica, HOY).tipo, "AL_DIA");
});

test("un compromiso incumplido escala pasada la gracia", () => {
  const politica = { ...BASE, diasGraciaCompromiso: 3 };
  const incumplidoHace3 = aviso({
    nivel: 1,
    estado: "COMPROMISO_PAGO",
    compromisoPagoEn: dia(8, 9),
  });
  const accion = accionDeCobranza(10, incumplidoHace3, politica, HOY);
  assert.equal(accion.tipo, "AVISO_DEBIDO");
  assert.equal(accion.nivel, 2);
  assert.match(accion.motivo, /se incumplió hace 3 días/);

  const incumplidoAyer = aviso({
    nivel: 1,
    estado: "COMPROMISO_PAGO",
    compromisoPagoEn: dia(8, 11),
  });
  assert.equal(accionDeCobranza(10, incumplidoAyer, politica, HOY).tipo, "AL_DIA");
});

test("a igual nivel gana el motivo más accionable", () => {
  // Antigüedad y compromiso incumplido piden los dos el nivel 2. El que sirve
  // para llamar al cliente es el del compromiso.
  const accion = accionDeCobranza(
    20,
    aviso({ nivel: 1, estado: "COMPROMISO_PAGO", compromisoPagoEn: dia(8, 5) }),
    { ...BASE, diasGraciaCompromiso: 3 },
    HOY
  );
  assert.equal(accion.tipo, "AVISO_DEBIDO");
  assert.equal(accion.nivel, 2);
  assert.match(accion.motivo, /compromiso/);
});

test("el aviso final no inventa un nivel 4", () => {
  // Lo que sigue al aviso final —cobranza judicial, castigo, bloqueo— es una
  // decisión de una persona, no un escalón que el sistema pueda subir solo.
  const accion = accionDeCobranza(
    200,
    aviso({ nivel: 3, fecha: dia(7, 1), estado: "SIN_RESPUESTA" }),
    { ...BASE, diasSinRespuesta: 7 },
    HOY
  );
  assert.equal(accion.tipo, "AGOTADO");
  assert.match(accion.motivo, /decisión de Gerencia/);
});

test("la política se valida sin opinar sobre cuántos días son los correctos", () => {
  assert.equal(validarPolitica({ diasNivel2: 15, diasNivel3: 30, diasSinRespuesta: null, diasGraciaCompromiso: null }), null);
  // Con el nivel 3 por debajo del 2, el nivel 2 sería inalcanzable.
  assert.match(
    validarPolitica({ diasNivel2: 30, diasNivel3: 15, diasSinRespuesta: null, diasGraciaCompromiso: null }) ?? "",
    /más días vencidos/
  );
  assert.ok(validarPolitica({ diasNivel2: 15, diasNivel3: 15, diasSinRespuesta: null, diasGraciaCompromiso: null }));
  assert.ok(validarPolitica({ diasNivel2: -1, diasNivel3: 30, diasSinRespuesta: null, diasGraciaCompromiso: null }));
  assert.ok(validarPolitica({ diasNivel2: 15, diasNivel3: 30, diasSinRespuesta: 0, diasGraciaCompromiso: null }));
  assert.ok(validarPolitica({ diasNivel2: 15, diasNivel3: 30, diasSinRespuesta: 1.5, diasGraciaCompromiso: null }));
});

test("la política es una por compañía y se va con ella", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-pc-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  await prisma.politicaCobranza.create({
    data: { empresaId, actualizadoPorId: "u", actualizadoPorNombre: "u" },
  });
  // Los umbrales nacen en los que el sistema ya usaba; las reglas opcionales,
  // apagadas.
  const guardada = await prisma.politicaCobranza.findUniqueOrThrow({ where: { empresaId } });
  assert.equal(guardada.diasNivel2, 15);
  assert.equal(guardada.diasNivel3, 30);
  assert.equal(guardada.diasSinRespuesta, null);
  assert.equal(guardada.diasGraciaCompromiso, null);
  assert.equal(guardada.pausarEnDisputa, true);

  await assert.rejects(
    prisma.politicaCobranza.create({
      data: { empresaId, actualizadoPorId: "u", actualizadoPorNombre: "u" },
    }),
    "una compañía no puede tener dos políticas"
  );

  await prisma.empresa.delete({ where: { id: empresaId } });
  assert.equal(await prisma.politicaCobranza.count({ where: { empresaId } }), 0);
});

// --- Guardias estructurales -------------------------------------------------

test("nada crea avisos de cobranza por su cuenta", async () => {
  // La razón de ser del diseño: un aviso registra que alguien contactó al
  // cliente. Un trabajo por temporizador que creara esas filas estaría
  // fabricando un contacto que nunca ocurrió.
  const { execSync } = await import("node:child_process");
  const salida = execSync(
    'git grep -l "avisoCobranza.create" -- "src" || true',
    { cwd: process.cwd(), encoding: "utf8" }
  ).trim();
  const archivos = salida ? salida.split("\n") : [];
  assert.deepEqual(
    archivos,
    ["src/app/(app)/finanzas/cobranza/actions.ts"],
    "el aviso solo se crea desde la acción que dispara una persona"
  );

  const tareas = await readFile(resolve(process.cwd(), "src/lib/tareasProgramadas.ts"), "utf8");
  assert.doesNotMatch(tareas, /avisoCobranza|escalamiento/i, "ninguna tarea programada escala cobranza");
});

test("el nivel que se registra sale de la misma política que pinta la pantalla", async () => {
  // Antes la acción reimplementaba los umbrales (`dias > 30 ? 3 : ...`). Con
  // umbrales configurables, eso registraría un nivel distinto del que la
  // columna «Acción debida» está pidiendo.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/finanzas/cobranza/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function registrarAvisoCobranza"),
    acciones.indexOf("export async function registrarRespuestaAviso")
  );
  assert.ok(bloque.length > 0, "no se encontró la acción");
  // Sin los comentarios: el que explica este arreglo cita el código viejo, y
  // una guardia que se dispara con su propia explicación no sirve.
  const codigo = bloque.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(codigo, /dias > \d+ \?/, "los umbrales no se reimplementan aquí");
  assert.match(bloque, /nivelPorAntiguedad\(dias, politica\?\.diasNivel2, politica\?\.diasNivel3\)/);
  assert.match(bloque, /politicaCobranza\.findUnique\(\{ where: \{ empresaId \} \}\)/);
});

test("la acción debida se deriva, no se guarda", async () => {
  // Depende del día de hoy: guardarla sería garantizar que se quede vieja, el
  // mismo criterio que ya rige para el compromiso incumplido.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model AvisoCobranza"),
    esquema.indexOf("model AvisoCobranza") + 1200
  );
  assert.doesNotMatch(modelo, /accionDebida|nivelDebido|escalado/i);
});
