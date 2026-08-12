import assert from "node:assert/strict";
import { after, test } from "node:test";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "@/lib/prisma";
import { registrarMovimiento } from "@/lib/inventario";
import {
  postearCobro,
  postearPagoProveedor,
  postearRecepcionCompra,
  postearVenta,
} from "@/lib/contabilidad";
import { calcularUnidadesAProducir } from "@/lib/proyecciones";
import { construirFacturaUBL } from "@/lib/sunatUbl";

function estaDentro(ruta: string, padre: string): boolean {
  const relativa = relative(padre, ruta);
  return relativa !== "" && !relativa.startsWith(".." + sep) && relativa !== ".." && !isAbsolute(relativa);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) {
  throw new Error("Las pruebas requieren una DATABASE_URL SQLite explícita.");
}
const rutaBase = resolve(databaseUrl.slice("file:".length));
assert.ok(estaDentro(rutaBase, resolve(tmpdir())), "La base de pruebas debe vivir en el directorio temporal.");
assert.ok(!estaDentro(rutaBase, resolve(process.cwd())), "La base de pruebas no puede vivir dentro del repositorio.");

after(async () => {
  await prisma.$disconnect();
});

async function auditoria() {
  const usuario = await prisma.usuario.findFirstOrThrow({ where: { rol: "ADMIN", activo: true } });
  return { usuarioId: usuario.id, usuarioNombre: usuario.nombre };
}

async function asientosPorReferencia(referencia: string) {
  return prisma.asientoContable.findMany({
    where: { referencia },
    include: { detalles: true },
    orderBy: { numero: "asc" },
  });
}

type AsientoConDetalles = Awaited<ReturnType<typeof asientosPorReferencia>>[number];

function comprobarCuadre(asiento: AsientoConDetalles) {
  const debe = asiento.detalles.reduce((total, linea) => total + linea.debe.toNumber(), 0);
  const haber = asiento.detalles.reduce((total, linea) => total + linea.haber.toNumber(), 0);
  assert.equal(Math.round(debe * 100), Math.round(haber * 100));
}

test("kardex mantiene saldo por almacén y total agregado de forma atómica", async () => {
  const sufijo = Date.now().toString(36);
  const [categoria, almacen, audit] = await Promise.all([
    prisma.categoria.findFirstOrThrow(),
    prisma.almacen.findFirstOrThrow({ where: { activo: true } }),
    auditoria(),
  ]);
  const producto = await prisma.producto.create({
    data: { categoriaId: categoria.id, codigo: "TEST-" + sufijo, nombre: "Producto prueba " + sufijo },
  });
  const presentacion = await prisma.presentacion.create({
    data: {
      productoId: producto.id,
      sku: "TEST-" + sufijo,
      nombre: "Presentación prueba " + sufijo,
      contenidoKg: 1,
      precio: 10,
    },
  });

  await prisma.$transaction(async (tx) => {
    const entrada = await registrarMovimiento(tx, {
      tipoItem: "PRESENTACION",
      presentacionId: presentacion.id,
      tipoMovimiento: "ENTRADA",
      origen: "AJUSTE",
      cantidad: 25,
      motivo: "Prueba automatizada de entrada",
      almacenId: almacen.id,
      ...audit,
    });
    assert.deepEqual(entrada, { ok: true });

    const salida = await registrarMovimiento(tx, {
      tipoItem: "PRESENTACION",
      presentacionId: presentacion.id,
      tipoMovimiento: "SALIDA",
      origen: "AJUSTE",
      cantidad: 8,
      motivo: "Prueba automatizada de salida",
      almacenId: almacen.id,
      ...audit,
    });
    assert.deepEqual(salida, { ok: true });

    const insuficiente = await registrarMovimiento(tx, {
      tipoItem: "PRESENTACION",
      presentacionId: presentacion.id,
      tipoMovimiento: "SALIDA",
      origen: "AJUSTE",
      cantidad: 30,
      motivo: "Prueba automatizada sin stock",
      almacenId: almacen.id,
      ...audit,
    });
    assert.equal(insuficiente.ok, false);
  });

  const [actualizada, saldo, movimientos] = await Promise.all([
    prisma.presentacion.findUniqueOrThrow({ where: { id: presentacion.id } }),
    prisma.saldoAlmacen.findFirstOrThrow({
      where: { almacenId: almacen.id, tipoItem: "PRESENTACION", presentacionId: presentacion.id },
    }),
    prisma.movimientoKardex.findMany({ where: { presentacionId: presentacion.id } }),
  ]);
  assert.equal(actualizada.stock.toNumber(), 17);
  assert.equal(saldo.cantidad.toNumber(), 17);
  assert.equal(movimientos.length, 2, "La salida rechazada no debe dejar movimiento.");
});

test("venta y cobro generan asientos balanceados y trazables", async () => {
  const referencia = "FTEST-" + Date.now();
  const audit = await auditoria();
  await prisma.$transaction(async (tx) => {
    await postearVenta(
      tx,
      {
        numeroFactura: referencia,
        cliente: "Cliente automatizado",
        subtotal: 100,
        igv: 18,
        total: 118,
        costoVentas: 62.5,
      },
      audit
    );
    await postearCobro(tx, { numeroFactura: referencia, monto: 118 }, audit);
  });

  const asientos = await asientosPorReferencia(referencia);
  assert.equal(asientos.length, 3, "Venta, costo de venta y cobro deben generar tres asientos.");
  asientos.forEach(comprobarCuadre);
  assert.deepEqual(new Set(asientos.map((asiento) => asiento.origen)), new Set(["VENTA", "COBRO"]));
});

test("recepción de compra y pago generan asientos balanceados", async () => {
  const referencia = "PTEST-" + Date.now();
  const audit = await auditoria();
  await prisma.$transaction(async (tx) => {
    await postearRecepcionCompra(
      tx,
      {
        numeroRecepcion: "RCTEST-" + Date.now(),
        documentoProveedor: referencia,
        proveedor: "Proveedor automatizado",
        total: 250,
      },
      audit
    );
    await postearPagoProveedor(
      tx,
      { documentoProveedor: referencia, proveedor: "Proveedor automatizado", monto: 250 },
      audit
    );
  });

  const asientos = await asientosPorReferencia(referencia);
  assert.equal(asientos.length, 2, "Recepción y pago deben generar dos asientos.");
  asientos.forEach(comprobarCuadre);
  assert.deepEqual(
    new Set(asientos.map((asiento) => asiento.origen)),
    new Set(["COMPRA", "PAGO_PROVEEDOR"])
  );
});

test("producción, calidad y envasado conservan inventario y trazabilidad", async () => {
  const sufijo = Date.now().toString(36);
  const [categoria, almacen, audit] = await Promise.all([
    prisma.categoria.findFirstOrThrow(),
    prisma.almacen.findFirstOrThrow({ where: { activo: true } }),
    auditoria(),
  ]);
  const producto = await prisma.producto.create({
    data: { categoriaId: categoria.id, codigo: "PROD-" + sufijo, nombre: "Grasa prueba " + sufijo },
  });
  const presentacion = await prisma.presentacion.create({
    data: {
      productoId: producto.id,
      sku: "ENV-" + sufijo,
      nombre: "Balde prueba " + sufijo,
      contenidoKg: 1,
      precio: 20,
    },
  });
  const insumo = await prisma.insumo.create({
    data: {
      codigo: "MP-" + sufijo,
      nombre: "Materia prima prueba " + sufijo,
      tipo: "MATERIA_PRIMA",
      unidadMedida: "kg",
      costoUnitario: 4,
    },
  });
  const formula = await prisma.formula.create({
    data: {
      productoId: producto.id,
      version: 1,
      rendimientoKg: 10,
      vigenteDesde: new Date(),
      ...audit,
      detalles: { create: { insumoId: insumo.id, cantidad: 5 } },
    },
  });

  await prisma.$transaction(async (tx) => {
    assert.deepEqual(
      await registrarMovimiento(tx, {
        tipoItem: "INSUMO",
        insumoId: insumo.id,
        tipoMovimiento: "ENTRADA",
        origen: "AJUSTE",
        cantidad: 100,
        motivo: "Preparación de prueba automatizada",
        almacenId: almacen.id,
        ...audit,
      }),
      { ok: true }
    );

    const lote = await tx.loteGranel.create({
      data: {
        codigo: "LG-TEST-" + sufijo,
        formulaId: formula.id,
        kgObjetivo: 20,
        costoInsumos: 40,
        ...audit,
      },
    });
    assert.deepEqual(
      await registrarMovimiento(tx, {
        tipoItem: "INSUMO",
        insumoId: insumo.id,
        tipoMovimiento: "SALIDA",
        origen: "PRODUCCION",
        cantidad: 10,
        referencia: lote.codigo,
        almacenId: almacen.id,
        ...audit,
      }),
      { ok: true }
    );
    await tx.loteGranel.update({
      where: { id: lote.id },
      data: {
        kgProducidos: 19,
        mermaKg: 1,
        costoKg: 40 / 19,
        estado: "PENDIENTE_CALIDAD",
        fechaFin: new Date(),
      },
    });
    await tx.controlCalidad.create({
      data: { loteGranelId: lote.id, resultado: "APROBADO", ...audit },
    });
    await tx.loteGranel.update({
      where: { id: lote.id },
      data: { estado: "APROBADO", kgDisponibles: 19 },
    });
    const envasado = await tx.envasado.create({
      data: {
        codigo: "ENV-TEST-" + sufijo,
        loteGranelId: lote.id,
        presentacionId: presentacion.id,
        unidades: 10,
        unidadesDisponibles: 10,
        kgConsumidos: 10,
        costoTotal: 400 / 19,
        costoUnitario: 40 / 19,
        ...audit,
      },
    });
    assert.deepEqual(
      await registrarMovimiento(tx, {
        tipoItem: "PRESENTACION",
        presentacionId: presentacion.id,
        tipoMovimiento: "ENTRADA",
        origen: "ENVASADO",
        cantidad: 10,
        referencia: envasado.codigo,
        almacenId: almacen.id,
        ...audit,
      }),
      { ok: true }
    );
    await tx.loteGranel.update({ where: { id: lote.id }, data: { kgDisponibles: 9 } });
  });

  const [materiaPrima, terminado, lote, movimientos] = await Promise.all([
    prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } }),
    prisma.presentacion.findUniqueOrThrow({ where: { id: presentacion.id } }),
    prisma.loteGranel.findFirstOrThrow({
      where: { codigo: "LG-TEST-" + sufijo },
      include: { controlCalidad: true, envasados: true },
    }),
    prisma.movimientoKardex.findMany({
      where: { referencia: { in: ["LG-TEST-" + sufijo, "ENV-TEST-" + sufijo] } },
      orderBy: { fecha: "asc" },
    }),
  ]);
  assert.equal(materiaPrima.stock.toNumber(), 90);
  assert.equal(terminado.stock.toNumber(), 10);
  assert.equal(lote.estado, "APROBADO");
  assert.equal(lote.kgDisponibles.toNumber(), 9);
  assert.equal(lote.controlCalidad?.resultado, "APROBADO");
  assert.equal(lote.envasados[0]?.unidadesDisponibles, 10);
  assert.deepEqual(movimientos.map((movimiento) => movimiento.origen), ["PRODUCCION", "ENVASADO"]);
});
test("MRP protege stock comprometido por pedidos", () => {
  assert.equal(
    calcularUnidadesAProducir({ demandaProyectada: 50, stock: 100, stockReservado: 80, stockMinimo: 10 }),
    40
  );
  assert.equal(
    calcularUnidadesAProducir({ demandaProyectada: 50, stock: 100, stockReservado: 0, stockMinimo: 10 }),
    0
  );
});

test("UBL usa la tasa congelada y rechaza una tasa ausente", () => {
  const datos = {
    tipoDocumento: "FACTURA" as const,
    serie: "F001",
    numero: 1,
    clienteRuc: "20123456789",
    clienteDenominacion: "Cliente automatizado",
    fechaEmision: new Date("2026-08-12"),
    moneda: "PEN",
    totalGravada: 100,
    totalIgv: 10,
    total: 110,
    tasaIgv: 10,
    items: [{ descripcion: "Producto", unidadMedida: "NIU", cantidad: 1, valorUnitario: 100 }],
  };
  const emisor = { ruc: "20987654321", razonSocial: "Emisor automatizado" };
  const xml = construirFacturaUBL(datos, emisor);
  assert.match(xml, /<cbc:Percent>10<\/cbc:Percent>/);
  assert.doesNotMatch(xml, /<cbc:Percent>18<\/cbc:Percent>/);
  assert.throws(
    () => construirFacturaUBL({ ...datos, tasaIgv: undefined }, emisor),
    /Falta una tasa de IGV válida/
  );
});
