import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import type { DestinoDeLote } from "@/lib/despachoLote";
import {
  lotesQueConsumieron,
  netoConsumido,
  resumenTrazabilidadInsumo,
  type FilaConsumo,
} from "@/lib/trazabilidadInsumo";

// ---------------------------------------------------------------------------
// De un insumo recibido a los clientes que lo tienen.
//
// La ficha del lote ya contestaba hacia atrás —«¿de qué recepciones salió este
// lote?»—. Faltaba la de ida: «¿qué se fabricó con este material, y dónde
// está?». Es la consulta del día que un proveedor avisa de un problema, o del
// día que una inspección de entrada queda sin respaldo.
//
// Es una CONSULTA: no frena ni exige nada. El negocio fue explícito en que la
// trazabilidad relaciona, no bloquea.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

const destino = (cliente: string, cantidad: number): DestinoDeLote => ({
  cantidad,
  clienteId: cliente,
  clienteNombre: cliente,
  facturaNumero: "F001-1",
  pedidoNumero: "P-1",
  envasadoId: "e1",
  envasadoCodigo: "EV-1",
  presentacionNombre: "Balde 20 kg",
});

const fila = (parcial: Partial<FilaConsumo> = {}): FilaConsumo => ({
  loteGranelId: "L1",
  loteCodigo: "LG-0001",
  productoNombre: "Grasa EP-2",
  estadoLote: "APROBADO",
  asignacion: { cantidad: 100, devoluciones: [] },
  destinos: [],
  ...parcial,
});

// --- Lo que de verdad se consumió -------------------------------------------

test("el consumo es lo asignado menos lo devuelto", () => {
  assert.equal(netoConsumido({ cantidad: 100, devoluciones: [{ cantidad: 30 }] }), 70);
  assert.equal(
    netoConsumido({ cantidad: 100, devoluciones: [{ cantidad: 30 }, { cantidad: 20 }] }),
    50
  );
});

test("un material devuelto por completo no es un consumo", () => {
  // Mostrarlo sería acusar a un lote de llevar material que volvió al estante.
  assert.deepEqual(
    lotesQueConsumieron([fila({ asignacion: { cantidad: 100, devoluciones: [{ cantidad: 100 }] } })]),
    []
  );
});

test("dos tandas del mismo material en el mismo lote se suman en una fila", () => {
  const consumos = lotesQueConsumieron([
    fila({ asignacion: { cantidad: 60, devoluciones: [] } }),
    fila({ asignacion: { cantidad: 40, devoluciones: [] } }),
  ]);
  assert.equal(consumos.length, 1);
  assert.equal(consumos[0].cantidadConsumida, 100);
});

// --- El orden ---------------------------------------------------------------

test("lo que ya salió al cliente va primero, aunque lleve menos material", () => {
  // Ahí el problema dejó de ser de almacén.
  const consumos = lotesQueConsumieron([
    fila({ loteGranelId: "A", loteCodigo: "LG-A", asignacion: { cantidad: 900, devoluciones: [] } }),
    fila({
      loteGranelId: "B",
      loteCodigo: "LG-B",
      asignacion: { cantidad: 10, devoluciones: [] },
      destinos: [destino("Minera Andina S.A.C.", 5)],
    }),
  ]);
  assert.deepEqual(
    consumos.map((c) => c.loteCodigo),
    ["LG-B", "LG-A"]
  );
});

test("entre iguales, el que más material llevó", () => {
  const consumos = lotesQueConsumieron([
    fila({ loteGranelId: "A", loteCodigo: "LG-A", asignacion: { cantidad: 10, devoluciones: [] } }),
    fila({ loteGranelId: "B", loteCodigo: "LG-B", asignacion: { cantidad: 80, devoluciones: [] } }),
  ]);
  assert.deepEqual(
    consumos.map((c) => c.loteCodigo),
    ["LG-B", "LG-A"]
  );
});

test("el orden de entrada no cambia el resultado", () => {
  const entrada = [
    fila({ loteGranelId: "A", loteCodigo: "LG-A", asignacion: { cantidad: 10, devoluciones: [] } }),
    fila({
      loteGranelId: "B",
      loteCodigo: "LG-B",
      asignacion: { cantidad: 5, devoluciones: [] },
      destinos: [destino("Cliente", 1)],
    }),
    fila({ loteGranelId: "C", loteCodigo: "LG-C", asignacion: { cantidad: 80, devoluciones: [] } }),
  ];
  const directo = lotesQueConsumieron(entrada).map((c) => c.loteCodigo);
  const invertido = lotesQueConsumieron([...entrada].reverse()).map((c) => c.loteCodigo);
  assert.deepEqual(directo, invertido);
  assert.deepEqual(directo, ["LG-B", "LG-C", "LG-A"]);
});

// --- El resumen -------------------------------------------------------------

test("un mismo cliente en dos lotes cuenta una vez", () => {
  // Sumar el conteo de cada lote diría que el problema alcanza a más gente de
  // la que alcanza, que es exactamente el error que no se puede cometer al
  // decidir un recall.
  const consumos = lotesQueConsumieron([
    fila({ loteGranelId: "A", loteCodigo: "LG-A", destinos: [destino("Minera Andina S.A.C.", 10)] }),
    fila({ loteGranelId: "B", loteCodigo: "LG-B", destinos: [destino("Minera Andina S.A.C.", 4)] }),
  ]);
  const resumen = resumenTrazabilidadInsumo(consumos);
  assert.equal(resumen.clientesAfectados, 1);
  assert.equal(resumen.unidadesDespachadas, 14);
  assert.equal(resumen.lotesDespachados, 2);
});

test("el resumen suma el material y cuenta los lotes", () => {
  const consumos = lotesQueConsumieron([
    fila({ loteGranelId: "A", loteCodigo: "LG-A", asignacion: { cantidad: 30, devoluciones: [] } }),
    fila({ loteGranelId: "B", loteCodigo: "LG-B", asignacion: { cantidad: 70, devoluciones: [{ cantidad: 20 }] } }),
  ]);
  const resumen = resumenTrazabilidadInsumo(consumos);
  assert.equal(resumen.lotes, 2);
  assert.equal(resumen.cantidadConsumida, 80);
  assert.equal(resumen.lotesDespachados, 0);
});

test("sin consumos el resumen es cero y no nulo", () => {
  assert.deepEqual(resumenTrazabilidadInsumo([]), {
    lotes: 0,
    cantidadConsumida: 0,
    lotesDespachados: 0,
    unidadesDespachadas: 0,
    clientesAfectados: 0,
  });
});

// --- Que esté conectado -----------------------------------------------------

test("la pantalla de trazabilidad recorre las dos direcciones", async () => {
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /lotesQueConsumieron\(/, "no recorre del insumo hacia adelante");
  assert.match(pagina, /recepcionId/, "no acepta buscar por material recibido");
  // Y sigue acotada por compañía en la dirección nueva.
  assert.match(pagina, /recepcion: \{ ordenCompra: \{ empresaId \} \}/);
});

test("la lista de reensayo lleva a qué se fabricó con el material", async () => {
  // Antes decía «se consulta lote por lote»: una limitación declarada que esta
  // pantalla elimina.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/reensayos/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /recall\?recepcionId=/, "no enlaza a la trazabilidad del material");
  assert.doesNotMatch(pagina, /se consulta lote por lote/);
});

test("la resta del consumo vive en un solo lugar", async () => {
  // Estaba dentro de `devolverLoteInsumo` y hacía falta acá. Copiarla sería
  // cómo dos pantallas terminan discrepando sobre cuánto material lleva un
  // lote.
  const libreria = await readFile(resolve(RAIZ, "src/lib/trazabilidad.ts"), "utf8");
  assert.match(libreria, /netoConsumido\(/, "la devolución dejó de usar la función común");
});

// --- Contra la base ---------------------------------------------------------

test("la cadena completa: material recibido, lote fabricado, cliente", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const proveedor = await prisma.proveedor.findFirstOrThrow({ where: { empresaId } });
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId } });
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `TZI-${sufijo}`, nombre: `Grasa ${sufijo}` },
  });
  const formula = await prisma.formula.create({
    data: { empresaId, productoId: producto.id, version: 1, rendimientoKg: 100, usuarioId: "u", usuarioNombre: "u" },
  });
  const lote = await prisma.loteGranel.create({
    data: {
      empresaId,
      codigo: `LG-TZI-${sufijo}`,
      formulaId: formula.id,
      kgObjetivo: 100,
      kgProducidos: 100,
      estado: "APROBADO",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const orden = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-TZI-${sufijo}`,
      proveedorId: proveedor.id,
      total: 1000,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const recepcion = await prisma.recepcionCompra.create({
    data: {
      empresaId,
      ordenCompraId: orden.id,
      numero: `RC-TZI-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const detalle = await prisma.recepcionCompraDetalle.create({
    data: {
      recepcionId: recepcion.id,
      insumoId: insumo.id,
      cantidad: 500,
      costoUnitario: 10,
      cantidadDisponible: 200,
      numeroLoteProveedor: `PROV-${sufijo}`,
    },
  });

  try {
    const asignacion = await prisma.asignacionLoteInsumo.create({
      data: { loteGranelId: lote.id, recepcionCompraDetalleId: detalle.id, cantidad: 300 },
    });

    const leido = await prisma.recepcionCompraDetalle.findUniqueOrThrow({
      where: { id: detalle.id },
      select: {
        asignacionesLote: {
          select: {
            cantidad: true,
            devolucionAsignacionLoteInsumos: { select: { cantidad: true } },
            loteGranel: {
              select: {
                id: true,
                codigo: true,
                estado: true,
                formula: { select: { producto: { select: { nombre: true } } } },
              },
            },
          },
        },
      },
    });

    const consumos = lotesQueConsumieron(
      leido.asignacionesLote.map((a) => ({
        loteGranelId: a.loteGranel.id,
        loteCodigo: a.loteGranel.codigo,
        productoNombre: a.loteGranel.formula.producto.nombre,
        estadoLote: a.loteGranel.estado,
        asignacion: {
          cantidad: a.cantidad.toNumber(),
          devoluciones: a.devolucionAsignacionLoteInsumos.map((d) => ({
            cantidad: d.cantidad.toNumber(),
          })),
        },
        destinos: [],
      }))
    );

    assert.equal(consumos.length, 1, "el material recibido no llegó a su lote");
    assert.equal(consumos[0].loteCodigo, lote.codigo);
    assert.equal(consumos[0].cantidadConsumida, 300);
    assert.equal(consumos[0].productoNombre, producto.nombre);

    // La consulta no toca nada: es una lectura. El saldo de la recepción sigue
    // donde estaba.
    const intacto = await prisma.recepcionCompraDetalle.findUniqueOrThrow({
      where: { id: detalle.id },
    });
    assert.equal(intacto.cantidadDisponible.toNumber(), 200);

    await prisma.asignacionLoteInsumo.delete({ where: { id: asignacion.id } });
  } finally {
    await prisma.asignacionLoteInsumo.deleteMany({ where: { recepcionCompraDetalleId: detalle.id } });
    await prisma.recepcionCompraDetalle.delete({ where: { id: detalle.id } }).catch(() => {});
    await prisma.recepcionCompra.delete({ where: { id: recepcion.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
    await prisma.loteGranel.delete({ where: { id: lote.id } }).catch(() => {});
    await prisma.formula.delete({ where: { id: formula.id } }).catch(() => {});
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
  }
});
