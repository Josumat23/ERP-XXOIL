import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  JUSTIFICACION_MINIMA,
  OFERTAS_MINIMAS,
  montoComparable,
  ofertaMasBarata,
  revisarAdjudicacion,
  validarJustificacion,
  validarLicitacion,
  validarOferta,
} from "@/lib/licitacionFlete";

// Licitación de flete. Contratar flete es comprar un servicio: las reglas son
// las del RFQ de compras, y por las mismas razones.

const oferta = (parcial: Partial<Parameters<typeof montoComparable>[0]> = {}) => ({
  id: "o1",
  transportistaId: "t1",
  monto: 1000,
  moneda: "PEN",
  tipoCambio: 1,
  diasTransito: 3,
  ...parcial,
});

test("las ofertas se comparan en moneda funcional", () => {
  // Sin convertir, una oferta en dólares parecería siempre la más barata.
  assert.equal(montoComparable(oferta({ monto: 1000, moneda: "PEN" })), 1000);
  assert.equal(montoComparable(oferta({ monto: 300, moneda: "USD", tipoCambio: 3.8 })), 1140);

  // 300 USD a 3.80 son 1140, menos que 1200 soles. Comparadas por el número
  // suelto, la de 300 "parece" barata por la razón equivocada; convertidas,
  // resulta que además lo es.
  assert.equal(
    ofertaMasBarata([
      oferta({ id: "pen", monto: 1200 }),
      oferta({ id: "usd", monto: 300, moneda: "USD", tipoCambio: 3.8 }),
    ])?.id,
    "usd"
  );
  // Y con el tipo de cambio más alto se da vuelta: 300 × 4.20 = 1260 > 1200.
  assert.equal(
    ofertaMasBarata([
      oferta({ id: "pen", monto: 1200 }),
      oferta({ id: "usd", monto: 300, moneda: "USD", tipoCambio: 4.2 }),
    ])?.id,
    "pen"
  );
});

test("a igual monto gana la de menor tránsito", () => {
  // Si dos cuestan lo mismo, la que llega antes es mejor y no hay nada que
  // decidir.
  const ganadora = ofertaMasBarata([
    oferta({ id: "lenta", monto: 1000, diasTransito: 5 }),
    oferta({ id: "rapida", monto: 1000, diasTransito: 2 }),
  ]);
  assert.equal(ganadora?.id, "rapida");
});

test("no se adjudica con una sola oferta", () => {
  // Una cotización no es una comparación.
  const revision = revisarAdjudicacion({
    estado: "ABIERTA",
    ofertas: [oferta()],
    ofertaElegidaId: "o1",
    solicitanteId: "quien-pide",
    adjudicadorId: "quien-adjudica",
  });
  assert.equal(revision.puede, false);
  assert.match(revision.motivo, new RegExp(String(OFERTAS_MINIMAS)));
});

test("quien solicita no adjudica", () => {
  const revision = revisarAdjudicacion({
    estado: "ABIERTA",
    ofertas: [oferta({ id: "a" }), oferta({ id: "b", transportistaId: "t2", monto: 1500 })],
    ofertaElegidaId: "a",
    solicitanteId: "misma-persona",
    adjudicadorId: "misma-persona",
  });
  assert.equal(revision.puede, false);
  assert.match(revision.motivo, /no puede adjudicarla/);
});

test("una licitación cerrada no se vuelve a adjudicar", () => {
  for (const estado of ["ADJUDICADA", "DESIERTA"]) {
    const revision = revisarAdjudicacion({
      estado,
      ofertas: [oferta({ id: "a" }), oferta({ id: "b", transportistaId: "t2" })],
      ofertaElegidaId: "a",
      solicitanteId: "x",
      adjudicadorId: "y",
    });
    assert.equal(revision.puede, false, `estado ${estado}`);
  }
});

test("adjudicar la más cara se permite, pero se dice cuánto cuesta", () => {
  // Elegir al más caro puede ser lo correcto —cumple plazo, tiene la unidad
  // adecuada— y el sistema no sabe nada de eso. Lo que hace es decirlo, para
  // que la justificación se escriba sabiendo lo que se justifica.
  const ofertas = [
    oferta({ id: "barata", monto: 1000 }),
    oferta({ id: "cara", transportistaId: "t2", monto: 1350 }),
  ];
  const base = { estado: "ABIERTA", ofertas, solicitanteId: "x", adjudicadorId: "y" };

  const cara = revisarAdjudicacion({ ...base, ofertaElegidaId: "cara" });
  assert.equal(cara.puede, true);
  assert.equal(cara.esLaMasBarata, false);
  assert.equal(cara.sobrecosto, 350);

  const barata = revisarAdjudicacion({ ...base, ofertaElegidaId: "barata" });
  assert.equal(barata.puede, true);
  assert.equal(barata.esLaMasBarata, true);
  assert.equal(barata.sobrecosto, 0);
});

test("una oferta ajena a la licitación no se adjudica", () => {
  const revision = revisarAdjudicacion({
    estado: "ABIERTA",
    ofertas: [oferta({ id: "a" }), oferta({ id: "b", transportistaId: "t2" })],
    ofertaElegidaId: "de-otra-licitacion",
    solicitanteId: "x",
    adjudicadorId: "y",
  });
  assert.equal(revision.puede, false);
  assert.match(revision.motivo, /no pertenece/);
});

test("la justificación tiene largo mínimo, como en el RFQ", () => {
  assert.match(validarJustificacion("corta") ?? "", new RegExp(String(JUSTIFICACION_MINIMA)));
  assert.match(validarJustificacion("   ") ?? "", /al menos/);
  assert.equal(validarJustificacion("Cumple el plazo y tiene furgón refrigerado"), null);
  assert.match(validarJustificacion("x".repeat(1001)) ?? "", /1000/);
});

test("una oferta en dólares sin tipo de cambio no se puede comparar", () => {
  assert.equal(validarOferta({ monto: 100, diasTransito: 2, moneda: "PEN", tipoCambio: 1 }), null);
  assert.match(
    validarOferta({ monto: 100, diasTransito: 2, moneda: "USD", tipoCambio: 0 }) ?? "",
    /tipo de cambio/
  );
  assert.match(validarOferta({ monto: 0, diasTransito: 2, moneda: "PEN", tipoCambio: 1 }) ?? "", /mayor a 0/);
  assert.match(validarOferta({ monto: 10, diasTransito: -1, moneda: "PEN", tipoCambio: 1 }) ?? "", /entero/);
  assert.match(validarOferta({ monto: 10, diasTransito: 1.5, moneda: "PEN", tipoCambio: 1 }) ?? "", /entero/);
});

test("el tramo y el peso son obligatorios", () => {
  const base = { titulo: "Despacho a Trujillo", origen: "Lima", destino: "Trujillo", pesoEstimadoKg: 500 };
  assert.equal(validarLicitacion(base), null);
  assert.match(validarLicitacion({ ...base, titulo: " " }) ?? "", /título/);
  assert.match(validarLicitacion({ ...base, destino: "" }) ?? "", /destino/);
  assert.match(validarLicitacion({ ...base, pesoEstimadoKg: 0 }) ?? "", /peso/);
});

test("un transportista cotiza una sola vez por licitación", async () => {
  // Dos cotizaciones del mismo no son dos ofertas: contarlas como tales
  // vaciaría el mínimo de dos.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-lf-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const t = await prisma.transportista.create({
    data: { empresaId, codigo: "TRA-00001", razonSocial: "Fletes" },
  });
  const l = await prisma.licitacionFlete.create({
    data: {
      empresaId,
      numero: `LF-${sufijo}`,
      titulo: "Tramo",
      origen: "Lima",
      destino: "Trujillo",
      fechaRequerida: new Date(),
      pesoEstimadoKg: 500,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const datos = {
    licitacionId: l.id,
    transportistaId: t.id,
    monto: 1000,
    diasTransito: 2,
    usuarioId: "u",
    usuarioNombre: "u",
  };
  await prisma.ofertaFlete.create({ data: datos });
  await assert.rejects(prisma.ofertaFlete.create({ data: datos }));

  // Borrar la licitación se lleva sus ofertas...
  await prisma.licitacionFlete.delete({ where: { id: l.id } });
  assert.equal(await prisma.ofertaFlete.count({ where: { licitacionId: l.id } }), 0);
});

test("un transportista con ofertas no se puede borrar", async () => {
  // Restrict: la oferta es parte del sustento de una adjudicación, y no puede
  // quedar apuntando a nadie.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-lf2-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const t = await prisma.transportista.create({
    data: { empresaId, codigo: "TRA-00001", razonSocial: "Fletes" },
  });
  const l = await prisma.licitacionFlete.create({
    data: {
      empresaId,
      numero: `LF-${sufijo}`,
      titulo: "Tramo",
      origen: "Lima",
      destino: "Trujillo",
      fechaRequerida: new Date(),
      pesoEstimadoKg: 500,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  await prisma.ofertaFlete.create({
    data: {
      licitacionId: l.id,
      transportistaId: t.id,
      monto: 1000,
      diasTransito: 2,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  await assert.rejects(prisma.transportista.delete({ where: { id: t.id } }));
});

// --- Guardias estructurales -------------------------------------------------

test("adjudicar NO emite la guía de remisión", async () => {
  // Una guía documenta un traslado que ocurre, con su fecha, su peso y sus
  // ítems reales. Emitirla al adjudicar fabricaría un traslado que no pasó —
  // el mismo criterio que impide que el escalamiento de cobranza emita avisos.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/licitaciones-flete/actions.ts"),
    "utf8"
  );
  const bloque = acciones
    .slice(acciones.indexOf("export async function adjudicarFlete"), acciones.indexOf("export async function declararDesierta"))
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(bloque.length > 0, "no se encontró la acción");
  assert.doesNotMatch(bloque, /guiaRemision\.create/, "adjudicar no emite guía");
  assert.match(bloque, /cerrada\.count !== 1/, "hace falta el cierre optimista");
});

test("la guía toma el transportista de la oferta adjudicada", async () => {
  // Adjudicar a uno y despachar con otro vaciaría la licitación entera, así
  // que el transportista no sale del formulario cuando hay licitación.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/guias-remision/actions.ts"),
    "utf8"
  );
  assert.match(
    acciones,
    /licitacionFlete\.findFirst\(\{\s*where: \{ id: licitacionFleteId, empresaId: empresaIdGuia, estado: "ADJUDICADA" \}/,
    "la licitación se relee acotada a la compañía y al estado adjudicado"
  );
  assert.match(acciones, /transportistaId = ganadora\.transportistaId;/);
});

test("el monto acordado no se copia a la guía", async () => {
  // Dos números para el mismo precio: tarde o temprano uno queda viejo. La
  // guía apunta a la licitación y el precio se lee de la oferta.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const guia = esquema
    .slice(esquema.indexOf("model GuiaRemision {"), esquema.indexOf("model GuiaRemisionDetalle"))
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(guia, /licitacionFleteId\s+String\?/);
  assert.doesNotMatch(guia, /montoFlete|costoFlete|tarifaFlete/);
});

test("las acciones de la licitación validan la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/licitaciones-flete/actions.ts"),
    "utf8"
  );
  // Los dos ids de la oferta llegan del navegador.
  const oferta = acciones.slice(
    acciones.indexOf("export async function registrarOfertaFlete"),
    acciones.indexOf("export async function adjudicarFlete")
  );
  assert.match(oferta, /licitacionFlete\.findFirst\(\{\s*where: \{ id: licitacionId, empresaId \}/);
  assert.match(oferta, /transportista\.findFirst\(\{\s*where: \{ id: transportistaId, empresaId, activo: true \}/);
  // Y las dos resoluciones se acotan por compañía en el propio where.
  assert.match(acciones, /where: \{ id: licitacionId, empresaId, estado: "ABIERTA" \}/);
});
