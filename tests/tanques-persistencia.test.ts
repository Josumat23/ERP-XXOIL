import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import {
  consumirDeTanque,
  contenidoRealTanque,
  descargarEnTanque,
} from "@/lib/tanquesServicio";
import { asignarLoteInsumo } from "@/lib/trazabilidad";

// ---------------------------------------------------------------------------
// El tanque contra la base de verdad.
//
// El reparto proporcional ya está probado como función pura en
// `tanques.test.ts`. Lo que se comprueba acá es lo que no se puede probar sin
// base: que descargar y consumir dejen la contabilidad de kilos cuadrada, y
// —lo que de verdad importa— que **la trazabilidad sobreviva a la mezcla**.
//
// La pregunta que estas pruebas contestan es la del día de un reclamo: si un
// lote de base sale defectuoso, ¿qué lotes de producción lo recibieron y en qué
// proporción? SAP contesta esa pregunta mal, porque obliga a elegir un lote al
// consumir y su registro termina afirmando algo que no pasó.
// ---------------------------------------------------------------------------

const empresaId = "1";

async function auditoria() {
  const usuario = await prisma.usuario.findFirstOrThrow({ where: { rol: "ADMIN", activo: true } });
  return { usuarioId: usuario.id, usuarioNombre: usuario.nombre };
}

/** Un tanque vacío con dos recepciones listas para descargar. */
async function escenario(sufijo: string) {
  const audit = await auditoria();
  const almacen = await prisma.almacen.findFirstOrThrow({ where: { empresaId } });

  const proveedor = await prisma.proveedor.create({
    data: { empresaId, razonSocial: "Base lubricante " + sufijo, ruc: "20" + sufijo.padStart(9, "0").slice(-9) },
  });
  const insumo = await prisma.insumo.create({
    data: {
      empresaId,
      codigo: "BASE-" + sufijo,
      nombre: "Base 150 SN " + sufijo,
      tipo: "MATERIA_PRIMA",
      unidadMedida: "KG",
      stock: 0,
      costoUnitario: 8,
    },
  });
  const oc = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: "OC-TQ-" + sufijo,
      proveedorId: proveedor.id,
      total: 1000,
      usuarioId: audit.usuarioId,
      usuarioNombre: audit.usuarioNombre,
    },
  });
  const recepcion = await prisma.recepcionCompra.create({
    data: { empresaId, numero: "RC-TQ-" + sufijo, ordenCompraId: oc.id, ...audit },
  });

  // Dos recepciones del MISMO insumo: es lo que se va a mezclar.
  const lotes = await Promise.all(
    [
      { numeroLoteProveedor: "LP-A-" + sufijo, cantidad: 6000 },
      { numeroLoteProveedor: "LP-B-" + sufijo, cantidad: 4000 },
    ].map((l) =>
      prisma.recepcionCompraDetalle.create({
        data: {
          recepcionId: recepcion.id,
          insumoId: insumo.id,
          cantidad: l.cantidad,
          cantidadDisponible: l.cantidad,
          costoUnitario: 8,
          numeroLoteProveedor: l.numeroLoteProveedor,
        },
      })
    )
  );

  const tanque = await prisma.tanque.create({
    data: {
      empresaId,
      almacenId: almacen.id,
      codigo: "TQ-" + sufijo,
      nombre: "Tanque base " + sufijo,
      insumoId: insumo.id,
      capacidadKg: 20000,
    },
  });

  return { audit, insumo, tanque, lotes };
}

/** Un lote de producción al que consumir. */
async function loteDeProduccion(sufijo: string, audit: { usuarioId: string; usuarioNombre: string }) {
  const formula = await prisma.formula.findFirstOrThrow({ where: { activo: true } });
  return prisma.loteGranel.create({
    data: {
      empresaId,
      codigo: "LG-TQ-" + sufijo,
      formulaId: formula.id,
      kgObjetivo: 1000,
      usuarioId: audit.usuarioId,
      usuarioNombre: audit.usuarioNombre,
    },
  });
}

test("descargar suma al tanque y resta de la recepción, sin crear ni perder kilos", async () => {
  const sufijo = "d" + Date.now().toString(36);
  const { tanque, lotes } = await escenario(sufijo);

  await prisma.$transaction(async (tx) => {
    const r = await descargarEnTanque(tx, {
      tanqueId: tanque.id,
      recepcionCompraDetalleId: lotes[0].id,
      cantidadKg: 6000,
      empresaId,
    });
    assert.deepEqual(r, { ok: true });
  });

  const despues = await prisma.tanque.findUniqueOrThrow({ where: { id: tanque.id } });
  assert.equal(despues.contenidoKg.toNumber(), 6000);

  // El stock dejó de estar disponible como envase suelto: se movió, no se duplicó.
  const detalle = await prisma.recepcionCompraDetalle.findUniqueOrThrow({ where: { id: lotes[0].id } });
  assert.equal(detalle.cantidadDisponible.toNumber(), 0);

  // Y el total declarado coincide con el detalle de aportes.
  assert.equal(await contenidoRealTanque(prisma, tanque.id), 6000);
});

test("un tanque no acepta un insumo que no es el suyo", async () => {
  // Mezclar productos distintos en un tanque no es un caso a soportar: es un
  // incidente, y el sistema no debe ayudar a provocarlo.
  const sufijo = "x" + Date.now().toString(36);
  const { tanque } = await escenario(sufijo);
  const audit = await auditoria();

  const proveedorAjeno = await prisma.proveedor.create({
    data: { empresaId, razonSocial: "Aditivos " + sufijo, ruc: "21" + sufijo.padStart(9, "0").slice(-9) },
  });
  const otro = await prisma.insumo.create({
    data: {
      empresaId,
      codigo: "OTRO-" + sufijo,
      nombre: "Aditivo " + sufijo,
      tipo: "MATERIA_PRIMA",
      unidadMedida: "KG",
      stock: 0,
      costoUnitario: 30,
    },
  });
  const oc = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: "OC-X-" + sufijo,
      proveedorId: proveedorAjeno.id,
      total: 100,
      usuarioId: audit.usuarioId,
      usuarioNombre: audit.usuarioNombre,
    },
  });
  const recepcion = await prisma.recepcionCompra.create({
    data: { empresaId, numero: "RC-X-" + sufijo, ordenCompraId: oc.id, ...audit },
  });
  const ajeno = await prisma.recepcionCompraDetalle.create({
    data: { recepcionId: recepcion.id, insumoId: otro.id, cantidad: 100, cantidadDisponible: 100, costoUnitario: 30 },
  });

  await prisma.$transaction(async (tx) => {
    const r = await descargarEnTanque(tx, {
      tanqueId: tanque.id,
      recepcionCompraDetalleId: ajeno.id,
      cantidadKg: 100,
      empresaId,
    });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /un solo producto/);
  });
});

test("no se descarga más de lo que la recepción tiene disponible", async () => {
  const sufijo = "s" + Date.now().toString(36);
  const { tanque, lotes } = await escenario(sufijo);

  await prisma.$transaction(async (tx) => {
    const r = await descargarEnTanque(tx, {
      tanqueId: tanque.id,
      recepcionCompraDetalleId: lotes[0].id,
      cantidadKg: 6000.01,
      empresaId,
    });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /no tiene esa cantidad disponible/);
  });
  // Y el tanque sigue vacío: la negativa ocurre antes de mover nada.
  const t = await prisma.tanque.findUniqueOrThrow({ where: { id: tanque.id } });
  assert.equal(t.contenidoKg.toNumber(), 0);
});

test("una descarga que no entra en el tanque se rechaza", async () => {
  // Descargar de más no es un redondeo: es producto en el piso.
  const sufijo = "c" + Date.now().toString(36);
  const { tanque, lotes } = await escenario(sufijo);
  await prisma.tanque.update({ where: { id: tanque.id }, data: { capacidadKg: 5000 } });

  await prisma.$transaction(async (tx) => {
    const r = await descargarEnTanque(tx, {
      tanqueId: tanque.id,
      recepcionCompraDetalleId: lotes[0].id,
      cantidadKg: 6000,
      empresaId,
    });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /no entra en el tanque/);
  });
});

test("consumir de una mezcla reparte la trazabilidad, no la inventa", async () => {
  // LA prueba de este módulo. Un tanque con 60 % del lote A y 40 % del B:
  // consumir 1.000 kg tiene que dejar constancia de 600 de A y 400 de B.
  //
  // SAP, en cambio, obliga a elegir un lote y su registro afirma «salió del
  // lote A» — el día de un reclamo eso manda a revisar el lote que no era.
  const sufijo = "m" + Date.now().toString(36);
  const { tanque, lotes, audit } = await escenario(sufijo);
  const lote = await loteDeProduccion(sufijo, audit);

  await prisma.$transaction(async (tx) => {
    for (const [i, cantidad] of [6000, 4000].entries()) {
      const r = await descargarEnTanque(tx, {
        tanqueId: tanque.id,
        recepcionCompraDetalleId: lotes[i].id,
        cantidadKg: cantidad,
        empresaId,
      });
      assert.deepEqual(r, { ok: true });
    }
  });

  await prisma.$transaction(async (tx) => {
    const r = await consumirDeTanque(tx, {
      tanqueId: tanque.id,
      loteGranelId: lote.id,
      cantidadKg: 1000,
      empresaId,
    });
    assert.deepEqual(r, { ok: true });
  });

  const asignaciones = await prisma.asignacionLoteInsumo.findMany({
    where: { loteGranelId: lote.id },
    include: { recepcionCompraDetalle: true },
  });

  // Dos asignaciones, una por recepción que aportó — no una sola inventada.
  assert.equal(asignaciones.length, 2, "la mezcla tiene que producir una asignación por lote");
  const porLote = new Map(
    asignaciones.map((a) => [a.recepcionCompraDetalle.numeroLoteProveedor, a.cantidad.toNumber()])
  );
  assert.equal(porLote.get("LP-A-" + sufijo), 600);
  assert.equal(porLote.get("LP-B-" + sufijo), 400);

  // Y el tanque quedó con lo que corresponde, con el total cuadrado contra su
  // propio detalle.
  const despues = await prisma.tanque.findUniqueOrThrow({ where: { id: tanque.id } });
  assert.equal(despues.contenidoKg.toNumber(), 9000);
  assert.equal(await contenidoRealTanque(prisma, tanque.id), 9000);
});

test("la proporción de hoy no es la de ayer, y el aporte inicial lo conserva", async () => {
  // Después de consumir, el tanque cambia de composición. Sin `cantidadInicialKg`
  // no se podría reconstruir la mezcla de un despacho pasado — que es justo lo
  // que hace falta el día de un reclamo.
  const sufijo = "p" + Date.now().toString(36);
  const { tanque, lotes, audit } = await escenario(sufijo);
  const lote = await loteDeProduccion(sufijo, audit);

  await prisma.$transaction(async (tx) => {
    await descargarEnTanque(tx, { tanqueId: tanque.id, recepcionCompraDetalleId: lotes[0].id, cantidadKg: 6000, empresaId });
    await consumirDeTanque(tx, { tanqueId: tanque.id, loteGranelId: lote.id, cantidadKg: 3000, empresaId });
  });

  const aporte = await prisma.aporteTanque.findFirstOrThrow({ where: { tanqueId: tanque.id } });
  assert.equal(aporte.cantidadKg.toNumber(), 3000, "lo que queda");
  assert.equal(aporte.cantidadInicialKg.toNumber(), 6000, "lo que entró, que no cambia");
});

test("no se consume de un tanque vacío ni más de lo que tiene", async () => {
  const sufijo = "v" + Date.now().toString(36);
  const { tanque, lotes, audit } = await escenario(sufijo);
  const lote = await loteDeProduccion(sufijo, audit);

  await prisma.$transaction(async (tx) => {
    const vacio = await consumirDeTanque(tx, { tanqueId: tanque.id, loteGranelId: lote.id, cantidadKg: 100, empresaId });
    assert.equal(vacio.ok, false);
    assert.match((vacio as { error: string }).error, /no tiene contenido/);
  });

  await prisma.$transaction(async (tx) => {
    await descargarEnTanque(tx, { tanqueId: tanque.id, recepcionCompraDetalleId: lotes[0].id, cantidadKg: 6000, empresaId });
    const exceso = await consumirDeTanque(tx, { tanqueId: tanque.id, loteGranelId: lote.id, cantidadKg: 6001, empresaId });
    assert.equal(exceso.ok, false);
    assert.match((exceso as { error: string }).error, /no se sobregira/);
  });

  // Ninguna asignación de trazabilidad quedó de los intentos fallidos.
  assert.equal(await prisma.asignacionLoteInsumo.count({ where: { loteGranelId: lote.id } }), 0);
});

test("producción consume del tanque, y eso ya no queda sin trazar", async () => {
  // El cierre del círculo, y el defecto más silencioso de todos.
  //
  // `asignarLoteInsumo` consumía FIFO de recepciones sueltas. Una base
  // descargada en tanque tiene `cantidadDisponible = 0` —el saldo se movió al
  // tanque— así que el FIFO no encontraba nada y el consumo quedaba SIN TRAZAR,
  // en silencio, por el comentario «best-effort». Justo para el insumo donde
  // más importa, porque es el que llega a granel.
  const sufijo = "t" + Date.now().toString(36);
  const { tanque, lotes, insumo, audit } = await escenario(sufijo);
  const lote = await loteDeProduccion(sufijo, audit);

  await prisma.$transaction(async (tx) => {
    for (const [i, cantidad] of [6000, 4000].entries()) {
      await descargarEnTanque(tx, {
        tanqueId: tanque.id,
        recepcionCompraDetalleId: lotes[i].id,
        cantidadKg: cantidad,
        empresaId,
      });
    }
  });

  // Ninguna recepción tiene ya saldo suelto: todo está en el tanque.
  const sueltos = await prisma.recepcionCompraDetalle.findMany({
    where: { insumoId: insumo.id, cantidadDisponible: { gt: 0 } },
  });
  assert.equal(sueltos.length, 0, "el escenario tiene que dejar todo dentro del tanque");

  // Producción consume por el camino normal, sin saber que hay un tanque.
  await prisma.$transaction((tx) =>
    asignarLoteInsumo(tx, { loteGranelId: lote.id, insumoId: insumo.id, cantidad: 500 })
  );

  const asignaciones = await prisma.asignacionLoteInsumo.findMany({
    where: { loteGranelId: lote.id },
    include: { recepcionCompraDetalle: true },
  });

  assert.equal(asignaciones.length, 2, "el consumo desde el tanque no se trazó");
  const porLote = new Map(
    asignaciones.map((a) => [a.recepcionCompraDetalle.numeroLoteProveedor, a.cantidad.toNumber()])
  );
  assert.equal(porLote.get("LP-A-" + sufijo), 300, "60 % de 500");
  assert.equal(porLote.get("LP-B-" + sufijo), 200, "40 % de 500");

  const despues = await prisma.tanque.findUniqueOrThrow({ where: { id: tanque.id } });
  assert.equal(despues.contenidoKg.toNumber(), 9500);
});

test("con saldo suelto y tanque, primero se agota el suelto", async () => {
  // El orden importa y no puede cambiar bajo los pies de nadie: sin tanques el
  // comportamiento tiene que ser idéntico al de siempre.
  const sufijo = "o" + Date.now().toString(36);
  const { tanque, lotes, insumo, audit } = await escenario(sufijo);
  const lote = await loteDeProduccion(sufijo, audit);

  // Solo el lote A va al tanque; el B queda suelto.
  await prisma.$transaction((tx) =>
    descargarEnTanque(tx, {
      tanqueId: tanque.id,
      recepcionCompraDetalleId: lotes[0].id,
      cantidadKg: 6000,
      empresaId,
    })
  );

  await prisma.$transaction((tx) =>
    asignarLoteInsumo(tx, { loteGranelId: lote.id, insumoId: insumo.id, cantidad: 1000 })
  );

  const asignaciones = await prisma.asignacionLoteInsumo.findMany({
    where: { loteGranelId: lote.id },
    include: { recepcionCompraDetalle: true },
  });
  // Los 1.000 salen enteros del suelto (B tiene 4.000): el tanque no se toca.
  assert.equal(asignaciones.length, 1);
  assert.equal(asignaciones[0].recepcionCompraDetalle.numeroLoteProveedor, "LP-B-" + sufijo);
  assert.equal(asignaciones[0].cantidad.toNumber(), 1000);

  const despues = await prisma.tanque.findUniqueOrThrow({ where: { id: tanque.id } });
  assert.equal(despues.contenidoKg.toNumber(), 6000, "el tanque no debía tocarse");
});

test("un tanque de otra compañía no se toca", async () => {
  // El aislamiento multi-empresa no es opcional en un maestro nuevo.
  const sufijo = "e" + Date.now().toString(36);
  const { tanque, lotes } = await escenario(sufijo);

  await prisma.$transaction(async (tx) => {
    const r = await descargarEnTanque(tx, {
      tanqueId: tanque.id,
      recepcionCompraDetalleId: lotes[0].id,
      cantidadKg: 100,
      empresaId: "empresa-que-no-es",
    });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /no es de la compañía activa/);
  });
});
