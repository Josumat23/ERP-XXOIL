import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { lotesDeUnaVenta, type EnvasadoConLote } from "@/lib/despachoLote";

// ---------------------------------------------------------------------------
// Del reclamo al lote.
//
// Un reclamo de cliente registraba cliente, factura, causa y descripción — y
// nada sobre el LOTE. Quien investiga no sabía qué revisar, ni si el problema
// alcanza a alguien más, aunque el dato estuviera guardado desde siempre: el
// comentario de `AsignacionLoteVenta` en el esquema dice literalmente que ese
// ledger existe «para responder, ante un reclamo de calidad o un recall, ¿qué
// facturas/clientes recibieron unidades del lote X?». Nadie lo había
// conectado con la pantalla de reclamos.
//
// Se deriva de la factura y no se declara nada nuevo en el reclamo. Si la
// factura llevó tres lotes, los tres son candidatos: elegir uno sería inventar
// una precisión que el documento no tiene.
//
// Los DOS caminos cuentan. Una unidad puede estar atada al renglón de la
// factura o al de la guía que esa factura ampara. Los datos de prueba de hoy
// solo usan el primero —23 asignaciones por factura, cero por guía—, así que
// la segunda rama se ejercita acá a propósito: si no, sería código que nadie
// probó nunca, prometiendo una respuesta completa.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const PAGINA = "src/app/(app)/produccion/calidad/reclamos/[id]/page.tsx";
const leerPagina = () => readFile(resolve(RAIZ, PAGINA), "utf8");

const envasado = (
  id: string,
  loteId: string,
  asignaciones: EnvasadoConLote["asignacionesLote"]
): EnvasadoConLote => ({
  id,
  codigo: `ENV-${id}`,
  presentacion: { nombre: "Balde 35 lb" },
  asignacionesLote: asignaciones,
  loteGranel: {
    id: loteId,
    codigo: `LG-${loteId}`,
    estado: "APROBADO",
    formula: { producto: { nombre: "Grasa Chasis" } },
  },
});

const asignacion = (
  tipo: "ASIGNADA" | "LIBERADA",
  cantidad: number,
  linea = "d1"
): EnvasadoConLote["asignacionesLote"][number] => ({
  tipo,
  cantidad,
  pedidoDetalleId: linea,
  facturaDetalleId: null,
  guiaDetalleId: null,
  pedidoDetalle: {
    pedido: { numero: "PED-1", cliente: { id: "c1", razonSocial: "Minera Andina S.A.C." } },
  },
  facturaDetalle: { factura: { numero: "F001-1" } },
  guiaDetalle: null,
});

// --- La aritmética ----------------------------------------------------------

test("sin envasados no hay lote que señalar", () => {
  assert.deepEqual(lotesDeUnaVenta([]), []);
});

test("agrupa por lote, sumando sus envases", () => {
  const filas = lotesDeUnaVenta([
    envasado("a", "L1", [asignacion("ASIGNADA", 10, "d1")]),
    envasado("b", "L1", [asignacion("ASIGNADA", 4, "d2")]),
    envasado("c", "L2", [asignacion("ASIGNADA", 7, "d3")]),
  ]);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].loteGranelId, "L1");
  assert.equal(filas[0].unidades, 14);
  assert.equal(filas[0].envasados.length, 2);
  assert.equal(filas[1].unidades, 7);
});

test("primero el lote que más salió en esa venta", () => {
  const filas = lotesDeUnaVenta([
    envasado("a", "poco", [asignacion("ASIGNADA", 2, "d1")]),
    envasado("b", "mucho", [asignacion("ASIGNADA", 30, "d2")]),
  ]);
  assert.deepEqual(
    filas.map((f) => f.loteGranelId),
    ["mucho", "poco"]
  );
});

test("un renglón devuelto por completo no señala ningún lote", () => {
  // El cliente no lo tiene: acusarlo de reclamar sobre algo que devolvió sería
  // mandarlo a revisar un lote que no le llegó.
  const filas = lotesDeUnaVenta([
    envasado("a", "L1", [asignacion("ASIGNADA", 5, "d1"), asignacion("LIBERADA", 5, "d1")]),
  ]);
  assert.deepEqual(filas, []);
});

test("una devolución parcial deja el saldo, no el total", () => {
  const filas = lotesDeUnaVenta([
    envasado("a", "L1", [asignacion("ASIGNADA", 9, "d1"), asignacion("LIBERADA", 4, "d1")]),
  ]);
  assert.equal(filas[0].unidades, 5);
});

test("el mismo envase en dos renglones se suma en una línea", () => {
  const filas = lotesDeUnaVenta([
    envasado("a", "L1", [asignacion("ASIGNADA", 3, "d1"), asignacion("ASIGNADA", 6, "d2")]),
  ]);
  assert.equal(filas[0].envasados.length, 1);
  assert.equal(filas[0].envasados[0].cantidad, 9);
});

// --- La pantalla ------------------------------------------------------------

test("la pantalla mira los dos caminos de la venta", async () => {
  // Una unidad puede estar atada al renglón de la factura o al de la guía que
  // esa factura ampara. Mirar solo el primero devolvería media respuesta con
  // cara de completa.
  const pagina = await leerPagina();
  assert.match(pagina, /facturaDetalle: \{ facturaId: reclamo\.facturaId \}/);
  assert.match(
    pagina,
    /facturaAsignaciones: \{ some: \{ facturaDetalle: \{ facturaId: reclamo\.facturaId \} \} \}/,
    "no contempla las unidades atadas a la guía"
  );
});

test("solo se netean los renglones de ESTA factura", async () => {
  // La resta ASIGNADA − LIBERADA es por renglón; mezclar otras ventas del
  // mismo envasado daría un neto que no es de esta factura.
  const pagina = await leerPagina();
  assert.match(pagina, /asignacionesLote: \{\s*where: deLaFactura/);
});

test("la consulta está acotada a la compañía", async () => {
  const pagina = await leerPagina();
  assert.match(pagina, /where: \{ empresaId: usuario\.empresaId, asignacionesLote: \{ some: deLaFactura \} \}/);
});

test("sin factura no se inventa un lote: se dice que no hay por dónde", async () => {
  const pagina = await leerPagina();
  assert.match(pagina, /!reclamo\.facturaId \?/);
  assert.match(pagina, /no hay por dónde llegar al lote/);
});

test("con varios lotes se muestran todos, sin elegir uno", async () => {
  // Decir «es este» eligiendo uno sería inventar una precisión que el
  // documento no tiene.
  const pagina = await leerPagina();
  assert.match(pagina, /el reclamo corresponde a alguno de ellos/);
  assert.match(pagina, /Derivado de la venta; el reclamo no declara el lote/);
});

test("la factura sin trazabilidad tiene su propio mensaje", async () => {
  // No es lo mismo «no hay factura» que «la factura no tiene unidades atadas a
  // un lote»: son dos situaciones distintas y dos cosas distintas que hacer.
  const pagina = await leerPagina();
  assert.match(pagina, /lotesReclamados\.length === 0 \?/);
  assert.match(pagina, /no tiene unidades vigentes asignadas a ningún\s+lote/);
});

test("desde el lote se llega a quién más lo tiene", async () => {
  // Es la pregunta siguiente y la razón de todo el ciclo: si el reclamo tiene
  // razón, ¿a quién más le llegó?
  const pagina = await leerPagina();
  assert.match(pagina, /lotes\/recall\?loteId=\$\{l\.loteGranelId\}/);
  assert.match(pagina, /quién más lo tiene/);
});

test("la pantalla de reclamos sigue sin escribir por esta vía", async () => {
  // El detalle ya tenía su formulario de estado, que es una acción aparte. La
  // derivación del lote no agrega escrituras.
  const pagina = await leerPagina();
  assert.doesNotMatch(
    pagina,
    /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/,
    "la página de detalle empezó a escribir en la base"
  );
});

// --- Contra la base ---------------------------------------------------------

/** La condición que usa la pantalla, tal cual. */
const deLaFactura = (facturaId: string) => ({
  OR: [
    { facturaDetalle: { facturaId } },
    { guiaDetalle: { facturaAsignaciones: { some: { facturaDetalle: { facturaId } } } } },
  ],
});

test("una factura sembrada llega a sus lotes", async () => {
  const detalle = await prisma.facturaDetalle.findFirst({
    where: {
      factura: { empresaId: "1", estado: { not: "ANULADA" } },
      asignacionesLote: { some: {} },
    },
    select: {
      facturaId: true,
      asignacionesLote: { select: { envasado: { select: { loteGranelId: true } } } },
    },
  });
  if (!detalle) return; // Base sin sembrar.

  const envasados = await prisma.envasado.findMany({
    where: { empresaId: "1", asignacionesLote: { some: deLaFactura(detalle.facturaId) } },
    select: { id: true, loteGranelId: true },
  });
  const lotes = new Set(envasados.map((e) => e.loteGranelId));
  for (const a of detalle.asignacionesLote) {
    assert.ok(
      lotes.has(a.envasado.loteGranelId),
      "un lote que salió en la factura no apareció en la consulta"
    );
  }
});

test("la unidad atada a la guía también llega al lote", async () => {
  // La rama que los datos de prueba no ejercitan. Se arma a mano: una guía con
  // su renglón, atada a un renglón de factura por `FacturaDetalleEntrega`, y
  // una asignación que cuelga de la guía y NO de la factura.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const base = await prisma.facturaDetalle.findFirst({
    where: {
      factura: { empresaId: "1", estado: { not: "ANULADA" } },
      asignacionesLote: { some: {} },
    },
    select: {
      id: true,
      facturaId: true,
      presentacionId: true,
      factura: { select: { clienteId: true } },
      asignacionesLote: {
        select: { envasadoId: true, pedidoDetalleId: true, envasado: { select: { loteGranelId: true } } },
      },
    },
  });
  if (!base) return; // Base sin sembrar.
  const modelo = base.asignacionesLote[0];

  const guia = await prisma.guiaRemision.create({
    data: {
      empresaId: "1",
      numero: `T999-${sufijo}`,
      clienteId: base.factura.clienteId,
      fechaTraslado: new Date(),
      puntoPartida: "Planta",
      puntoLlegada: "Cliente",
      usuarioId: "test",
      usuarioNombre: "test",
    },
  });
  const guiaDetalle = await prisma.guiaRemisionDetalle.create({
    data: { guiaId: guia.id, presentacionId: base.presentacionId, cantidad: 1 },
  });
  const entrega = await prisma.facturaDetalleEntrega.create({
    data: { facturaDetalleId: base.id, guiaDetalleId: guiaDetalle.id, cantidad: 1 },
  });
  const porGuia = await prisma.asignacionLoteVenta.create({
    data: {
      pedidoDetalleId: modelo.pedidoDetalleId,
      envasadoId: modelo.envasadoId,
      guiaDetalleId: guiaDetalle.id,
      // Sin facturaDetalleId: es EXACTAMENTE el caso que la primera rama no ve.
      tipo: "ASIGNADA",
      cantidad: 1,
    },
  });

  try {
    // Solo por la rama de la guía: se comprueba que esa condición sola alcanza.
    const soloGuia = await prisma.asignacionLoteVenta.findMany({
      where: {
        id: porGuia.id,
        guiaDetalle: {
          facturaAsignaciones: { some: { facturaDetalle: { facturaId: base.facturaId } } },
        },
      },
      select: { id: true, envasado: { select: { loteGranelId: true } } },
    });
    assert.equal(soloGuia.length, 1, "la unidad atada a la guía no se alcanza desde la factura");
    assert.equal(soloGuia[0].envasado.loteGranelId, modelo.envasado.loteGranelId);

    // Y el lote se alcanza con la SEGUNDA rama sola. Comprobarlo con la
    // condición completa no probaría nada: este envasado también tiene una
    // asignación por factura, así que pasaría por la primera rama.
    const porLaRamaDeLaGuia = await prisma.envasado.findMany({
      where: {
        empresaId: "1",
        asignacionesLote: {
          some: {
            guiaDetalle: {
              facturaAsignaciones: { some: { facturaDetalle: { facturaId: base.facturaId } } },
            },
          },
        },
      },
      select: { loteGranelId: true },
    });
    assert.ok(
      porLaRamaDeLaGuia.some((e) => e.loteGranelId === modelo.envasado.loteGranelId),
      "la rama de la guía, sola, no alcanza el lote"
    );

    // Y la condición completa lo sigue incluyendo.
    const envasados = await prisma.envasado.findMany({
      where: { empresaId: "1", asignacionesLote: { some: deLaFactura(base.facturaId) } },
      select: { loteGranelId: true },
    });
    assert.ok(
      envasados.some((e) => e.loteGranelId === modelo.envasado.loteGranelId),
      "la consulta de la pantalla no ve el lote que llegó por la guía"
    );
  } finally {
    await prisma.asignacionLoteVenta.delete({ where: { id: porGuia.id } }).catch(() => {});
    await prisma.facturaDetalleEntrega.delete({ where: { id: entrega.id } }).catch(() => {});
    await prisma.guiaRemisionDetalle.delete({ where: { id: guiaDetalle.id } }).catch(() => {});
    await prisma.guiaRemision.delete({ where: { id: guia.id } }).catch(() => {});
  }
});

test("el sembrador deja un reclamo con factura para poder verlo", async () => {
  // Sin un reclamo cargado la sección no se puede ver ni probar a mano, y la
  // base sembrada no traía ninguno.
  const sembrador = await readFile(resolve(RAIZ, "prisma/seed-trazabilidad.ts"), "utf8");
  assert.match(sembrador, /sembrarReclamoDeEjemplo/);
  // Solo si no hay ninguno: el trabajo de alguien no se toca.
  assert.match(sembrador, /if \(yaHay > 0\)/);
  // Y contra una factura que de verdad llevó lotes, no una cualquiera.
  assert.match(sembrador, /asignacionesLote: \{ some: \{\} \}/);
});
