import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { normalizarCaracteristicasPlan } from "@/lib/planesCalidad";
import {
  CONSECUENCIA_ENSAYO,
  MENSAJE_DESTINO,
  MENSAJE_TIPO_ENSAYO,
  lotesPorReensayar,
  type MedicionParaRevisar,
} from "@/lib/reensayos";
import { revisarReensayos } from "@/lib/reensayosConsulta";

// ---------------------------------------------------------------------------
// El laboratorio también mide lo que ENTRA.
//
// Los ensayos de producción ya registraban con qué instrumento se midieron; la
// inspección de recepción no. Es el mismo laboratorio y son los mismos equipos:
// una calibración vencida no distingue entre lo que se compra y lo que se
// fabrica, y el aceite base aceptado con un viscosímetro descalibrado no
// aparecía en ninguna lista.
//
// Y en el camino: publicar un plan de inspección de insumos estaba ROTO.
// `normalizarCaracteristicasPlan` lo comparten el plan de producto y el de
// insumo, y cada campo que ganó para el producto —esDensidad, instrumentoId—
// llegaba al create de un modelo que no lo tiene. Dos ciclos sin que nada lo
// avisara: TypeScript no revisa propiedades de más cuando se pasa una
// variable, y no había prueba.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const F = (diasDesdeCero: number) => new Date(2026, 0, 1 + diasDesdeCero);

const medicion = (parcial: Partial<MedicionParaRevisar> = {}): MedicionParaRevisar => ({
  ensayo: "RECEPCION",
  itemId: "R1",
  itemCodigo: "REC-0001 · INS-01",
  loteGranelId: "",
  productoNombre: "Aceite base SN-500",
  disponibleEnAlmacen: true,
  unidadesDespachadas: 0,
  clientesAfectados: 0,
  fechaEnsayo: F(100),
  caracteristica: "Viscosidad a 100 °C",
  instrumentoId: "I1",
  instrumentoCodigo: "VIS-01",
  calibraciones: [],
  ...parcial,
});

// --- Cómo se nombra lo que entra --------------------------------------------

test("la inspección de recepción es un ensayo con nombre propio", () => {
  assert.equal(MENSAJE_TIPO_ENSAYO.RECEPCION, "Inspección de recepción");
  assert.match(CONSECUENCIA_ENSAYO.RECEPCION, /cumpliera al recibirlo/);
});

test("para un insumo, «ya salió» significa que se consumió en producción", () => {
  // Es la misma posición en la lista y es otra conversación: el problema ya no
  // es el insumo sino lo que se fabricó con él.
  assert.equal(MENSAJE_DESTINO.RECEPCION.DESPACHADO, "Ya se consumió en producción");
  assert.equal(MENSAJE_DESTINO.RECEPCION.EN_ALMACEN, "Todavía en almacén, sin consumir");
  // Y para lo que se vende sigue diciendo lo de siempre.
  assert.equal(MENSAJE_DESTINO.LIBERACION.DESPACHADO, "Ya está en poder del cliente");
});

test("una recepción sin respaldo entra en la lista de reensayo", () => {
  const items = lotesPorReensayar([medicion()]);
  assert.equal(items.length, 1);
  assert.equal(items[0].ensayo, "RECEPCION");
  assert.equal(items[0].itemCodigo, "REC-0001 · INS-01");
});

test("el insumo ya consumido urge más que el que sigue en almacén", () => {
  const items = lotesPorReensayar([
    medicion({ itemId: "A", itemCodigo: "REC-A", unidadesDespachadas: 0 }),
    medicion({ itemId: "B", itemCodigo: "REC-B", unidadesDespachadas: 500 }),
  ]);
  assert.deepEqual(
    items.map((i) => i.itemCodigo),
    ["REC-B", "REC-A"]
  );
});

test("un insumo y un lote se ordenan por la misma regla, sin privilegios", () => {
  // La urgencia la da dónde está el material, no de qué clase de ensayo viene.
  const items = lotesPorReensayar([
    medicion({ ensayo: "RECEPCION", itemId: "R", itemCodigo: "REC-A", unidadesDespachadas: 0 }),
    medicion({
      ensayo: "LIBERACION",
      itemId: "L",
      itemCodigo: "LG-0001",
      loteGranelId: "L",
      unidadesDespachadas: 3,
    }),
  ]);
  assert.deepEqual(
    items.map((i) => i.itemCodigo),
    ["LG-0001", "REC-A"]
  );
});

// --- Que esté conectado -----------------------------------------------------

test("la consulta recorre también lo que entra", async () => {
  const consulta = await readFile(resolve(RAIZ, "src/lib/reensayosConsulta.ts"), "utf8");
  assert.match(consulta, /medicionesInspeccion:/, "no mira las inspecciones de recepción");
  assert.match(consulta, /RECEPCION/, "no clasifica el ensayo de entrada");
  // Y las cuenta entre las que no declaran instrumento, en vez de darlas por
  // respaldadas.
  assert.match(consulta, /medicionInspeccionCompra\.count\(/);
});

test("la ficha del instrumento muestra lo que midió en recepción", async () => {
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/calidad/instrumentos/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /medicionInspeccionCompra\.findMany\(/, "no trae las inspecciones");
});

test("la inspección valida los instrumentos contra la compañía", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/logistica/inspeccion-compras/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /resultadosDelEnsayo\(/, "no usa la librería común");
  assert.match(acciones, /instrumentoMedicion\.count\([\s\S]{0,120}empresaId/);
});

test("el plan de insumos valida los instrumentos que declara", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/logistica/inspeccion-compras/planes/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /instrumentoMedicion\.count\([\s\S]{0,140}empresaId/);
});

test("el plan de insumos copia campo por campo, no el objeto entero", async () => {
  // La causa raíz del defecto. El normalizador lo comparten dos modelos
  // distintos; pasarle el objeto entero a Prisma rompe el día que uno de los
  // dos gana un campo.
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/logistica/inspeccion-compras/planes/actions.ts"),
    "utf8"
  );
  assert.doesNotMatch(
    acciones,
    /create:\s*caracteristicas\s*\}/,
    "volvió a pasar el objeto entero del normalizador"
  );
  assert.match(acciones, /secuencia:\s*c\.secuencia/);
});

// --- Contra la base ---------------------------------------------------------

test("publicar un plan de inspección de insumos funciona", async () => {
  // La prueba que faltaba. Sin ella, el campo que agregó el ciclo de la
  // densidad rompió esta pantalla y nadie se enteró: el normalizador devuelve
  // `esDensidad` y `CaracteristicaPlanInsumo` no lo tiene.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId } });
  const caracteristicas = normalizarCaracteristicasPlan(
    JSON.stringify([
      {
        nombre: "Viscosidad a 100 °C",
        unidadMedida: "cSt",
        limiteInferior: "13.5",
        limiteSuperior: "16.3",
        metodoEnsayo: "ASTM D445",
        obligatoria: true,
      },
    ])
  );

  const plan = await prisma.planInspeccionInsumo.create({
    data: {
      empresaId,
      insumoId: insumo.id,
      version: 9000 + Math.floor(Math.random() * 900),
      nombre: `Plan ${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
      caracteristicas: {
        create: caracteristicas.map((c) => ({
          secuencia: c.secuencia,
          nombre: c.nombre,
          unidadMedida: c.unidadMedida,
          limiteInferior: c.limiteInferior,
          limiteSuperior: c.limiteSuperior,
          metodoEnsayo: c.metodoEnsayo,
          obligatoria: c.obligatoria,
          instrumentoId: c.instrumentoId,
        })),
      },
    },
    include: { caracteristicas: true },
  });

  try {
    assert.equal(plan.caracteristicas.length, 1);
    assert.equal(plan.caracteristicas[0].nombre, "Viscosidad a 100 °C");
    assert.equal(plan.caracteristicas[0].instrumentoId, null);
  } finally {
    await prisma.caracteristicaPlanInsumo.deleteMany({ where: { planId: plan.id } });
    await prisma.planInspeccionInsumo.delete({ where: { id: plan.id } }).catch(() => {});
  }
});

test("pasarle el objeto entero del normalizador a Prisma falla", async () => {
  // El defecto tal cual era, para que quede claro que la prueba de arriba no
  // pasa por casualidad.
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId: "1" } });
  const caracteristicas = normalizarCaracteristicasPlan(
    JSON.stringify([
      { nombre: "X", unidadMedida: "cSt", limiteInferior: "1", limiteSuperior: "2", obligatoria: true },
    ])
  );
  await assert.rejects(
    prisma.planInspeccionInsumo.create({
      data: {
        empresaId: "1",
        insumoId: insumo.id,
        version: 9999,
        nombre: "No debería crearse",
        usuarioId: "u",
        usuarioNombre: "u",
        // TypeScript NO se queja acá: no revisa propiedades de más cuando se
        // pasa una variable en vez de un literal. Por eso llegó a producción.
        caracteristicas: { create: caracteristicas },
      },
    })
  );
});

test("una inspección medida con un instrumento sin calibrar entra en la lista", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const proveedor = await prisma.proveedor.findFirstOrThrow({ where: { empresaId } });
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId } });
  const instrumento = await prisma.instrumentoMedicion.create({
    data: { empresaId, codigo: `VIS-${sufijo}`, nombre: "Viscosímetro" },
  });

  const orden = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-TST-${sufijo}`,
      proveedorId: proveedor.id,
      total: 2000,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const recepcion = await prisma.recepcionCompra.create({
    data: {
      empresaId,
      ordenCompraId: orden.id,
      numero: `REC-TST-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const detalle = await prisma.recepcionCompraDetalle.create({
    data: {
      recepcionId: recepcion.id,
      insumoId: insumo.id,
      cantidad: 200,
      costoUnitario: 10,
      cantidadDisponible: 200,
    },
  });

  try {
    await prisma.inspeccionCompra.create({
      data: {
        recepcionCompraDetalleId: detalle.id,
        resultado: "APROBADO",
        fecha: new Date(),
        usuarioId: "u",
        usuarioNombre: "u",
        mediciones: {
          create: [
            {
              secuencia: 1,
              nombre: "Viscosidad a 100 °C",
              unidadMedida: "cSt",
              limiteInferior: 13.5,
              limiteSuperior: 16.3,
              valorMedido: 14.8,
              conforme: true,
              instrumentoId: instrumento.id,
            },
          ],
        },
      },
    });

    const revision = await revisarReensayos(empresaId);
    const fila = revision.items.find((i) => i.itemId === detalle.id);
    assert.ok(fila, "la inspección medida con un instrumento sin calibrar no apareció");
    assert.equal(fila.ensayo, "RECEPCION");
    assert.equal(fila.destino, "EN_ALMACEN", "tiene saldo y no se consumió");
    assert.match(fila.itemCodigo, new RegExp(`REC-TST-${sufijo}`));

    // Se consume en producción y pasa a urgir más: el problema deja de ser el
    // insumo y pasa a ser lo que se fabricó con él.
    const lote = await prisma.loteGranel.findFirst({ where: { empresaId } });
    if (lote) {
      await prisma.asignacionLoteInsumo.create({
        data: { loteGranelId: lote.id, recepcionCompraDetalleId: detalle.id, cantidad: 50 },
      });
      const despues = await revisarReensayos(empresaId);
      const consumido = despues.items.find((i) => i.itemId === detalle.id);
      assert.ok(consumido);
      assert.equal(consumido.destino, "DESPACHADO");
      assert.equal(consumido.unidadesDespachadas, 50);
    }
  } finally {
    await prisma.asignacionLoteInsumo.deleteMany({ where: { recepcionCompraDetalleId: detalle.id } });
    await prisma.medicionInspeccionCompra.deleteMany({
      where: { inspeccion: { recepcionCompraDetalleId: detalle.id } },
    });
    await prisma.inspeccionCompra.deleteMany({ where: { recepcionCompraDetalleId: detalle.id } });
    await prisma.recepcionCompraDetalle.delete({ where: { id: detalle.id } }).catch(() => {});
    await prisma.recepcionCompra.delete({ where: { id: recepcion.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
    await prisma.instrumentoMedicion.delete({ where: { id: instrumento.id } }).catch(() => {});
  }
});
