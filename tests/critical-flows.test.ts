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
import { evaluarCredito } from "@/lib/credito";
import { registrarAuditoriaMaestro, serializarCambiosMaestro } from "@/lib/auditoriaMaestros";
import { calcularRetencion5taMensual, generarPlanillaMensual } from "@/lib/planilla";
import { asignarLoteVenta, liberarAsignacionesLote } from "@/lib/trazabilidad";
import {
  calcularIntentoFallidoLogin,
  DURACION_BLOQUEO_LOGIN_MS,
  hashPassword,
  registrarIntentoFallidoLogin,
  verificarPasswordUniforme,
} from "@/lib/auth";

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
  const vendedor = await prisma.vendedor.create({
    data: { nombre: "Vendedor recall " + sufijo, tipo: "SOLO_COMISION", tasaComision: 2 },
  });
  const cliente = await prisma.cliente.create({
    data: { codigo: "CLI-RECALL-" + sufijo, razonSocial: "Cliente recall " + sufijo },
  });
  const pedido = await prisma.pedido.create({
    data: {
      numero: "PED-RECALL-" + sufijo,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      total: 140,
      ...audit,
      detalles: {
        create: { presentacionId: presentacion.id, cantidad: 7, precioUnitario: 20, subtotal: 140 },
      },
    },
    include: { detalles: true },
  });
  const detalleId = pedido.detalles[0]?.id;
  assert.ok(detalleId);

  await prisma.$transaction((tx) =>
    asignarLoteVenta(tx, { pedidoDetalleId: detalleId, presentacionId: presentacion.id, cantidad: 7 })
  );
  await prisma.$transaction((tx) =>
    liberarAsignacionesLote(tx, { pedidoDetalleId: detalleId, cantidad: 3, motivo: "Devolución parcial de prueba" })
  );
  await prisma.$transaction((tx) =>
    liberarAsignacionesLote(tx, { pedidoDetalleId: detalleId, motivo: "Anulación del saldo de prueba" })
  );
  await prisma.$transaction((tx) =>
    liberarAsignacionesLote(tx, { pedidoDetalleId: detalleId, motivo: "Segundo intento idempotente" })
  );

  const [envasadoRestituido, eventosRecall] = await Promise.all([
    prisma.envasado.findUniqueOrThrow({ where: { id: lote.envasados[0]!.id } }),
    prisma.asignacionLoteVenta.findMany({ where: { pedidoDetalleId: detalleId }, orderBy: { creadoEn: "asc" } }),
  ]);
  assert.equal(envasadoRestituido.unidadesDisponibles, 10);
  assert.deepEqual(
    eventosRecall.map((evento) => ({ tipo: evento.tipo, cantidad: evento.cantidad })),
    [
      { tipo: "ASIGNADA", cantidad: 7 },
      { tipo: "LIBERADA", cantidad: 3 },
      { tipo: "LIBERADA", cantidad: 4 },
    ]
  );
});
test("planilla usa parámetros versionados, excluye configuraciones incompletas y contabiliza", async () => {
  const audit = await auditoria();
  const vigenteDesde = new Date("2098-01-01T00:00:00.000Z");
  const plan = await prisma.planCuentas.findFirstOrThrow();

  assert.equal(calcularRetencion5taMensual(2_500, 5_000), 0);
  assert.equal(calcularRetencion5taMensual(3_000, 5_000), 46.67);

  await prisma.empleado.updateMany({ where: { estado: "ACTIVO" }, data: { estado: "CESADO" } });
  const cuentasPrueba = [
    { codigo: "TEST-6211", nombre: "Gasto de personal prueba", clave: "GASTO_PERSONAL", tipo: "GASTO" },
    { codigo: "TEST-4031", nombre: "Pensiones por pagar prueba", clave: "ONP_AFP_POR_PAGAR", tipo: "PASIVO" },
    { codigo: "TEST-4032", nombre: "EsSalud por pagar prueba", clave: "ESSALUD_POR_PAGAR", tipo: "PASIVO" },
    { codigo: "TEST-4017", nombre: "Quinta categoría por pagar prueba", clave: "RETENCION_5TA_POR_PAGAR", tipo: "PASIVO" },
    { codigo: "TEST-4111", nombre: "Sueldos por pagar prueba", clave: "SUELDOS_POR_PAGAR", tipo: "PASIVO" },
  ] satisfies Array<{ codigo: string; nombre: string; clave: string; tipo: "GASTO" | "PASIVO" }>;
  const cuentas = await Promise.all(
    cuentasPrueba.map(async ({ codigo, nombre, clave, tipo }) => {
      const cuenta = await prisma.cuentaContable.create({
        data: { planCuentasId: plan.id, codigo, nombre, tipo },
      });
      await prisma.controlContable.upsert({
        where: { empresaId_clave: { empresaId: "1", clave } },
        update: { cuentaId: cuenta.id },
        create: { clave, cuentaId: cuenta.id },
      });
      return cuenta;
    })
  );
  assert.equal(cuentas.length, 5);

  await prisma.parametroPlanilla.create({
    data: {
      rmv: 1_000,
      uit: 5_000,
      tasaEsSalud: 9,
      tasaOnp: 13,
      vigenteDesde,
      ...audit,
    },
  });
  await prisma.tasaAfp.create({
    data: {
      afp: "PRIMA",
      tipoComision: "FLUJO",
      tasaAporteObligatorio: 10,
      tasaComision: 1.5,
      primaSeguro: 1.5,
      vigenteDesde,
    },
  });

  const empleados = await Promise.all([
    prisma.empleado.create({
      data: {
        codigo: "EMP-TEST-ONP",
        nombres: "Ana",
        apellidos: "ONP",
        fechaIngreso: new Date("2098-01-01"),
        cargo: "Operaria",
        area: "Producción",
        tipoContrato: "PLAZO_INDETERMINADO",
        sueldoBasico: 2_000,
        sistemaPension: "ONP",
        asignacionFamiliar: true,
      },
    }),
    prisma.empleado.create({
      data: {
        codigo: "EMP-TEST-AFP",
        nombres: "Bruno",
        apellidos: "AFP",
        fechaIngreso: new Date("2098-01-01"),
        cargo: "Analista",
        area: "Administración",
        tipoContrato: "PLAZO_INDETERMINADO",
        sueldoBasico: 3_000,
        sistemaPension: "AFP",
        afp: "PRIMA",
      },
    }),
    prisma.empleado.create({
      data: {
        codigo: "EMP-TEST-INCOMPLETO",
        nombres: "Carla",
        apellidos: "Sin pensión",
        fechaIngreso: new Date("2098-01-01"),
        cargo: "Auxiliar",
        area: "Almacén",
        tipoContrato: "PLAZO_FIJO",
        sueldoBasico: 1_500,
      },
    }),
  ]);

  const resultado = await prisma.$transaction((tx) =>
    generarPlanillaMensual(tx, { anio: 2099, mes: 3, ...audit })
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.equal(resultado.advertencias?.length, 1);
  assert.match(resultado.advertencias?.[0] ?? "", /EMP-TEST-INCOMPLETO/);

  const periodo = await prisma.planillaPeriodo.findUniqueOrThrow({
    where: { id: resultado.periodoId },
    include: { detalles: { orderBy: { sueldoBasico: "asc" } } },
  });
  assert.equal(periodo.detalles.length, 2);
  assert.deepEqual(
    periodo.detalles.map((detalle) => detalle.empleadoId).sort(),
    empleados.slice(0, 2).map((empleado) => empleado.id).sort()
  );
  assert.deepEqual(
    periodo.detalles.map((detalle) => ({
      sueldo: detalle.sueldoBasico.toNumber(),
      familiar: detalle.asignacionFamiliar.toNumber(),
      pension: detalle.descuentoPension.toNumber(),
      essalud: detalle.essaludPatronal.toNumber(),
      quinta: detalle.retencion5ta.toNumber(),
      neto: detalle.neto.toNumber(),
    })),
    [
      { sueldo: 2_000, familiar: 100, pension: 273, essalud: 189, quinta: 0, neto: 1_827 },
      { sueldo: 3_000, familiar: 0, pension: 390, essalud: 270, quinta: 46.67, neto: 2_563.33 },
    ]
  );
  assert.ok(periodo.detalles.every((detalle) => detalle.asientoNumero));

  const asiento = await prisma.asientoContable.findFirstOrThrow({
    where: { origen: "PLANILLA", referencia: "2099-03" },
    include: { detalles: true },
  });
  comprobarCuadre(asiento);
  assert.equal(asiento.detalles.reduce((total, linea) => total + linea.debe.toNumber(), 0), 5_559);

  const duplicado = await prisma.$transaction((tx) =>
    generarPlanillaMensual(tx, { anio: 2099, mes: 3, ...audit })
  );
  assert.deepEqual(duplicado, { ok: false, error: "Ya existe una planilla mensual para 3/2099." });
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
test("login verifica credenciales inexistentes sin omitir el hash costoso", () => {
  const hash = hashPassword("clave-correcta");
  assert.equal(verificarPasswordUniforme("clave-correcta", hash), true);
  assert.equal(verificarPasswordUniforme("clave-incorrecta", hash), false);
  assert.equal(verificarPasswordUniforme("cualquier-clave", undefined), false);
});

test("login bloquea persistentemente la cuenta al quinto fallo y reinicia la ventana", async () => {
  const ahora = new Date("2026-08-12T15:00:00.000Z");
  const usuario = await prisma.usuario.findFirstOrThrow({ where: { rol: "ADMIN", activo: true } });
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, ultimoIntentoFallidoEn: null, bloqueadoHasta: null },
  });

  for (let intento = 0; intento < 5; intento += 1) {
    await registrarIntentoFallidoLogin(usuario.id, new Date(ahora.getTime() + intento * 1000));
  }

  const bloqueado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
  assert.equal(bloqueado.intentosFallidos, 5);
  assert.equal(
    bloqueado.bloqueadoHasta?.getTime(),
    ahora.getTime() + 4000 + DURACION_BLOQUEO_LOGIN_MS
  );

  const fueraDeVentana = calcularIntentoFallidoLogin(
    { intentosFallidos: 4, ultimoIntentoFallidoEn: ahora, bloqueadoHasta: null },
    new Date(ahora.getTime() + 16 * 60 * 1000)
  );
  assert.equal(fueraDeVentana.intentosFallidos, 1);
  assert.equal(fueraDeVentana.bloqueadoHasta, null);

  assert.ok(bloqueado.bloqueadoHasta);
  const despuesDelBloqueo = calcularIntentoFallidoLogin(
    bloqueado,
    new Date(bloqueado.bloqueadoHasta.getTime() + 1)
  );
  assert.equal(despuesDelBloqueo.intentosFallidos, 1);
  assert.equal(despuesDelBloqueo.bloqueadoHasta, null);
});
test("auditoría de maestros conserva actor y cambios sin exponer secretos", async () => {
  const [usuario, cliente] = await Promise.all([
    prisma.usuario.findFirstOrThrow({ where: { rol: "ADMIN", activo: true } }),
    prisma.cliente.findFirstOrThrow(),
  ]);

  await prisma.$transaction(async (tx) => {
    await registrarAuditoriaMaestro(tx, {
      empresaId: cliente.empresaId,
      entidad: "Cliente",
      registroId: cliente.id,
      accion: "ACTUALIZAR",
      antes: { razonSocial: cliente.razonSocial },
      despues: { razonSocial: `${cliente.razonSocial} auditado` },
      usuario,
    });
  });

  const auditoria = await prisma.auditoriaMaestro.findFirstOrThrow({
    where: { entidad: "Cliente", registroId: cliente.id },
    orderBy: { creadoEn: "desc" },
  });
  assert.equal(auditoria.usuarioId, usuario.id);
  assert.match(auditoria.valoresAntes ?? "", new RegExp(cliente.razonSocial));
  assert.equal(
    serializarCambiosMaestro({ passwordHash: "secreto", nombre: "visible" }),
    '{"passwordHash":"[PROTEGIDO]","nombre":"visible"}'
  );
});
test("crédito exige aprobación solo cuando la exposición supera un límite positivo", () => {
  assert.equal(evaluarCredito(800, 300, 1000).excede, true);
  assert.equal(evaluarCredito(700, 300, 1000).excede, false);
  assert.equal(evaluarCredito(800, 300, 0).excede, false);
  assert.equal(evaluarCredito(800, 300, 1000).exposicionProyectada, 1100);
});
