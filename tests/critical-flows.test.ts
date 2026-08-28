import assert from "node:assert/strict";
import { after, test } from "node:test";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { calcularCostoPromedioEntrada, registrarMovimiento } from "@/lib/inventario";
import {
  postearCobro,
  postearPagoProveedor,
  postearRecepcionCompra,
  postearVenta,
} from "@/lib/contabilidad";
import { calcularUnidadesAProducir, esPeriodoProyeccionValido } from "@/lib/proyecciones";
import { validarLineasSimulacion } from "@/lib/simuladorPrecios";
import { construirFacturaUBL } from "@/lib/sunatUbl";
import { esPeriodoPLEValido, generarArchivoPLE, sanitizarCampoPLE } from "@/lib/ple";
import { esAnioOperativoValido, esPeriodoMensualValido } from "@/lib/periodos";
import { esAprobacionCreditoVigente, evaluarCredito } from "@/lib/credito";
import { puedeResolverSolicitud } from "@/lib/aprobaciones";
import {
  TAMANIO_MAXIMO_CERTIFICADO_SUNAT,
  validarArchivoCertificadoSunat,
} from "@/lib/certificadoSunat";
import { existeGrupoSeguridadAsignable, puedeRealizar } from "@/lib/permisos";
import { obtenerOrigenesServerActions } from "@/lib/origenesServerActions";
import { resolverSecretoFormulario } from "@/lib/secretosFormulario";
import { escaparCeldaCsv } from "@/lib/csv";
import {
  crearFechaAsientoManual,
  cuentasAsientoPertenecenAEmpresa,
  normalizarLineasAsientoManual,
} from "@/lib/asientosManuales";
import { esValorEnum } from "@/lib/enums";
import { normalizarLineasVenta } from "@/lib/lineasVenta";
import { crearFechaCalendarioLocal } from "@/lib/fechas";
import { normalizarVisitasRuta } from "@/lib/visitasRuta";
import { normalizarLineasConteo } from "@/lib/lineasConteo";
import { normalizarDetallesFormula } from "@/lib/detallesFormula";
import { normalizarInsumosEnvasado } from "@/lib/insumosEnvasado";
import { normalizarRepuestosMantenimiento } from "@/lib/repuestosMantenimiento";
import { normalizarLecturaContador } from "@/lib/lecturasContador";
import { esMonedaOrdenCompraValida, normalizarLineasOrdenCompra } from "@/lib/lineasOrdenCompra";
import {
  esClaveControlValida,
  normalizarDestinoControlCosto,
  normalizarLineasReglaAsignacion,
} from "@/lib/reglasAsignacionCosto";
import { Afp, TipoComisionAfp, TipoDireccion } from "@/generated/prisma/client";
import { DIRECTORIO_ADJUNTOS, esTipoEntidadAdjunto, existeEntidadAdjunto, resolverRutaAdjunto } from "@/lib/adjuntos";
import { empresaSolicitadaPermitida, perteneceAEmpresaActiva } from "@/lib/empresas";
import { edtPerteneceAProyecto, siguienteCodigoActividad, siguienteCodigoEdt } from "@/lib/proyectos";
import { registrarAuditoriaMaestro, serializarCambiosMaestro } from "@/lib/auditoriaMaestros";
import { calcularRetencion5taMensual, esPorcentajePlanillaValido, generarPlanillaMensual } from "@/lib/planilla";
import { asignarLoteVenta, liberarAsignacionesLote } from "@/lib/trazabilidad";
import {
  esTipoComprobanteRecepcionValido,
  normalizarLineasRecepcionCompra,
  sonDiasCreditoRecepcionValidos,
} from "@/lib/recepcionesCompra";
import {
  calcularIntentoFallidoLogin,
  DURACION_BLOQUEO_LOGIN_MS,
  hashPassword,
  registrarIntentoFallidoLogin,
  verificarPasswordUniforme,
} from "@/lib/auth";

test("períodos operativos aceptan solo años y meses enteros dentro del rango", () => {
  assert.equal(esAnioOperativoValido(2000), true);
  assert.equal(esAnioOperativoValido(2100), true);
  assert.equal(esAnioOperativoValido(1999), false);
  assert.equal(esAnioOperativoValido(2101), false);
  assert.equal(esAnioOperativoValido(2026.5), false);
  assert.equal(esPeriodoMensualValido(2026, 1), true);
  assert.equal(esPeriodoMensualValido(2026, 12), true);
  assert.equal(esPeriodoMensualValido(2026, 0), false);
  assert.equal(esPeriodoMensualValido(2026, 13), false);
  assert.equal(esPeriodoMensualValido(2026, 1.5), false);
});

test("el envío interno de guías queda aislado de las Server Actions", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/guias-remision/actions.ts"),
    "utf8"
  );
  const servicio = await readFile(resolve(process.cwd(), "src/lib/guiasRemision.ts"), "utf8");

  assert.match(acciones, /export async function enviarComprobanteGuia/);
  assert.match(acciones, /requerirRol\(\["VENTAS", "ALMACEN"\]\)/);
  assert.doesNotMatch(acciones, /export async function enviarComprobanteGuiaInterno/);
  assert.match(servicio, /import ["']server-only["'];/);
});
test("la creación interna de órdenes no queda expuesta como Server Action", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/ordenes-compra/actions.ts"),
    "utf8"
  );
  const servicio = await readFile(resolve(process.cwd(), "src/lib/ordenesCompra.ts"), "utf8");

  assert.doesNotMatch(acciones, /export async function crearOrdenCompraDesdeDatos/);
  assert.match(servicio, /import ["']server-only["'];/);
});

test("asignaciones de costo aceptan solo claves y destinos registrados", () => {
  assert.equal(esClaveControlValida("GASTO_MANTENIMIENTO"), true);
  assert.equal(esClaveControlValida("CLAVE_MANIPULADA"), false);
  assert.deepEqual(normalizarDestinoControlCosto("centro:centro-1"), {
    tipo: "centro",
    id: "centro-1",
  });
  assert.deepEqual(normalizarDestinoControlCosto("regla:regla-1"), {
    tipo: "regla",
    id: "regla-1",
  });
  assert.equal(normalizarDestinoControlCosto("otro:id"), null);
  assert.equal(normalizarDestinoControlCosto("centro:"), null);
  assert.equal(normalizarDestinoControlCosto("centro:id:extra"), null);
});
test("reglas de costo validan estructura, porcentajes y centros únicos", () => {
  assert.equal(normalizarLineasReglaAsignacion({}), null);
  assert.deepEqual(normalizarLineasReglaAsignacion([null, "línea"]), []);
  assert.deepEqual(
    normalizarLineasReglaAsignacion([
      { centroCostoId: " centro-1 ", porcentaje: 60 },
      { centroCostoId: "centro-2", porcentaje: 40 },
      { centroCostoId: "centro-3", porcentaje: Number.NaN },
    ]),
    [
      { centroCostoId: "centro-1", porcentaje: 60 },
      { centroCostoId: "centro-2", porcentaje: 40 },
    ]
  );
  assert.equal(
    normalizarLineasReglaAsignacion([
      { centroCostoId: "centro-1", porcentaje: 50 },
      { centroCostoId: "centro-1", porcentaje: 50 },
    ]),
    null
  );
});
test("órdenes de compra rechazan monedas manipuladas", () => {
  assert.equal(esMonedaOrdenCompraValida("PEN"), true);
  assert.equal(esMonedaOrdenCompraValida("USD"), true);
  assert.equal(esMonedaOrdenCompraValida("EUR"), false);
  assert.equal(esMonedaOrdenCompraValida(""), false);
  assert.equal(esMonedaOrdenCompraValida(undefined), false);
});

test("órdenes de compra aceptan solo líneas con cantidades y costos válidos", () => {
  assert.equal(normalizarLineasOrdenCompra({}), null);
  assert.deepEqual(normalizarLineasOrdenCompra([null, "línea", { insumoId: "1" }]), []);
  assert.deepEqual(
    normalizarLineasOrdenCompra([
      { insumoId: "insumo-1", cantidad: 2, costoUnitario: 10.5, fechaEntregaEsperada: "2026-09-01" },
      { insumoId: "insumo-2", cantidad: 0, costoUnitario: 5 },
      { insumoId: "insumo-3", cantidad: 1, costoUnitario: Number.NaN },
    ]),
    [
      {
        insumoId: "insumo-1",
        cantidad: 2,
        costoUnitario: 10.5,
        fechaEntregaEsperada: new Date(2026, 8, 1),
      },
    ]
  );
  assert.equal(
    normalizarLineasOrdenCompra([
      { insumoId: "insumo-1", cantidad: 2, costoUnitario: 10.5, fechaEntregaEsperada: "2026-09-31" },
    ]),
    null
  );
});
test("lecturas de contador aceptan solo valores finitos no negativos", () => {
  assert.equal(normalizarLecturaContador(""), null);
  assert.equal(normalizarLecturaContador("100.25"), 100.25);
  assert.equal(normalizarLecturaContador("-1"), undefined);
  assert.equal(normalizarLecturaContador("texto"), undefined);
  assert.equal(normalizarLecturaContador("Infinity"), undefined);
});
test("mantenimiento acepta solo repuestos y cantidades consumibles válidas", () => {
  assert.equal(normalizarRepuestosMantenimiento({}), null);
  assert.deepEqual(normalizarRepuestosMantenimiento([null, "repuesto", { insumoId: "1", cantidad: "2" }]), []);
  assert.deepEqual(
    normalizarRepuestosMantenimiento([
      { insumoId: "repuesto-1", cantidad: 3 },
      { insumoId: "repuesto-2", cantidad: 0 },
      { insumoId: "repuesto-3", cantidad: Number.NEGATIVE_INFINITY },
    ]),
    [{ insumoId: "repuesto-1", cantidad: 3 }]
  );
});
test("envasados aceptan solo insumos y cantidades consumibles válidas", () => {
  assert.equal(normalizarInsumosEnvasado({}), null);
  assert.deepEqual(normalizarInsumosEnvasado([null, "insumo", { insumoId: "1", cantidad: "2" }]), []);
  assert.deepEqual(
    normalizarInsumosEnvasado([
      { insumoId: "envase-1", cantidad: 10 },
      { insumoId: "etiqueta-1", cantidad: -1 },
      { insumoId: "etiqueta-2", cantidad: Number.NaN },
    ]),
    [{ insumoId: "envase-1", cantidad: 10 }]
  );
});
test("fórmulas aceptan solo insumos y cantidades productivas válidas", () => {
  assert.equal(normalizarDetallesFormula({}), null);
  assert.deepEqual(normalizarDetallesFormula([null, "detalle", { insumoId: "1", cantidad: "2" }]), []);
  assert.deepEqual(
    normalizarDetallesFormula([
      { insumoId: "insumo-1", cantidad: 2.5 },
      { insumoId: "insumo-2", cantidad: 0 },
      { insumoId: "insumo-3", cantidad: Number.POSITIVE_INFINITY },
    ]),
    [{ insumoId: "insumo-1", cantidad: 2.5 }]
  );
});
test("conteos aceptan solo ítems y cantidades físicas válidas", () => {
  assert.equal(normalizarLineasConteo({}), null);
  assert.deepEqual(normalizarLineasConteo([null, "línea", { tipoItem: "OTRO", itemId: "1", cantidadContada: 2 }]), []);
  assert.deepEqual(
    normalizarLineasConteo([
      { tipoItem: "PRESENTACION", itemId: "presentacion-1", cantidadContada: 0 },
      { tipoItem: "INSUMO", itemId: "insumo-1", cantidadContada: 2.5 },
      { tipoItem: "INSUMO", itemId: "insumo-2", cantidadContada: -1 },
      { tipoItem: "INSUMO", itemId: "insumo-3", cantidadContada: Number.NaN },
    ]),
    [
      { tipoItem: "PRESENTACION", itemId: "presentacion-1", cantidadContada: 0 },
      { tipoItem: "INSUMO", itemId: "insumo-1", cantidadContada: 2.5 },
    ]
  );
});
test("hojas de ruta ignoran visitas vacías y rechazan estructuras manipuladas", () => {
  assert.equal(normalizarVisitasRuta({}), null);
  assert.deepEqual(normalizarVisitasRuta([null, "visita", { clienteId: "", objetivo: "" }]), []);
  assert.deepEqual(
    normalizarVisitasRuta([
      { clienteId: "cliente-1", objetivo: "Cobrar factura" },
      { clienteId: "cliente-1", objetivo: "Presentar producto" },
      { clienteId: "cliente-2", objetivo: 123 },
    ]),
    [
      { clienteId: "cliente-1", objetivo: "Cobrar factura" },
      { clienteId: "cliente-1", objetivo: "Presentar producto" },
    ]
  );
});
test("fechas calendario rechazan días inexistentes y formatos manipulados", () => {
  const fecha = crearFechaCalendarioLocal("2028-02-29");
  assert.equal(fecha?.getFullYear(), 2028);
  assert.equal(fecha?.getMonth(), 1);
  assert.equal(fecha?.getDate(), 29);
  assert.equal(crearFechaCalendarioLocal("2026-02-29"), null);
  assert.equal(crearFechaCalendarioLocal("2026-04-31"), null);
  assert.equal(crearFechaCalendarioLocal("31/12/2026"), null);
  assert.equal(crearFechaCalendarioLocal(""), null);
});
test("pedidos ignoran filas vacías y rechazan estructuras JSON manipuladas", () => {
  assert.equal(normalizarLineasVenta({}), null);
  assert.deepEqual(normalizarLineasVenta([null, "línea", { presentacionId: "", cantidad: 0, precioUnitario: 0 }]), []);
  assert.deepEqual(
    normalizarLineasVenta([
      { presentacionId: "presentacion-1", cantidad: 2, precioUnitario: 15.5 },
      { presentacionId: "presentacion-2", cantidad: 1.5, precioUnitario: 10 },
      { presentacionId: "presentacion-3", cantidad: 1, precioUnitario: -1 },
      { presentacionId: "presentacion-4", cantidad: 1, precioUnitario: Number.NaN },
    ]),
    [{ presentacionId: "presentacion-1", cantidad: 2, precioUnitario: 15.5 }]
  );
});
test("asientos manuales aceptan solo cuentas activas de la compañía contable", async () => {
  const sufijo = Date.now().toString();
  const planPrincipal = await prisma.planCuentas.create({
    data: { empresaId: "empresa-contable-a", codigo: `PLAN-A-${sufijo}`, nombre: "Plan A" },
  });
  const planAjeno = await prisma.planCuentas.create({
    data: { empresaId: "empresa-contable-b", codigo: `PLAN-B-${sufijo}`, nombre: "Plan B" },
  });
  const [cuentaActiva, cuentaInactiva, cuentaAjena] = await Promise.all([
    prisma.cuentaContable.create({
      data: { planCuentasId: planPrincipal.id, codigo: `A-${sufijo}`, nombre: "Activa", tipo: "ACTIVO" },
    }),
    prisma.cuentaContable.create({
      data: { planCuentasId: planPrincipal.id, codigo: `I-${sufijo}`, nombre: "Inactiva", tipo: "ACTIVO", activo: false },
    }),
    prisma.cuentaContable.create({
      data: { planCuentasId: planAjeno.id, codigo: `X-${sufijo}`, nombre: "Ajena", tipo: "ACTIVO" },
    }),
  ]);

  assert.equal(
    await cuentasAsientoPertenecenAEmpresa(prisma, [cuentaActiva.id], "empresa-contable-a"),
    true
  );
  assert.equal(
    await cuentasAsientoPertenecenAEmpresa(prisma, [cuentaActiva.id, cuentaActiva.id], "empresa-contable-a"),
    true
  );
  assert.equal(
    await cuentasAsientoPertenecenAEmpresa(prisma, [cuentaInactiva.id], "empresa-contable-a"),
    false
  );
  assert.equal(
    await cuentasAsientoPertenecenAEmpresa(prisma, [cuentaAjena.id], "empresa-contable-a"),
    false
  );
  assert.equal(await cuentasAsientoPertenecenAEmpresa(prisma, ["inexistente"], "empresa-contable-a"), false);
});
test("asientos manuales rechazan fechas e importes manipulados antes de contabilizar", () => {
  assert.equal(crearFechaAsientoManual("2026-08-20")?.getDate(), 20);
  assert.equal(crearFechaAsientoManual("2026-02-29"), null);
  assert.equal(crearFechaAsientoManual("20/08/2026"), null);
  assert.equal(normalizarLineasAsientoManual({}), null);
  assert.equal(normalizarLineasAsientoManual([null]), null);
  assert.equal(
    normalizarLineasAsientoManual([{ cuentaId: "101", glosa: "Caja", debe: Number.NaN, haber: 0 }]),
    null
  );
  assert.equal(
    normalizarLineasAsientoManual([{ cuentaId: "101", glosa: "Caja", debe: -1, haber: 0 }]),
    null
  );
  assert.deepEqual(
    normalizarLineasAsientoManual([
      { cuentaId: "101", glosa: "Caja", debe: 10.126, haber: 0 },
      { cuentaId: "701", glosa: "Venta", debe: 0, haber: 10.126 },
    ]),
    [
      { cuentaId: "101", glosa: "Caja", debe: 10.13, haber: 0 },
      { cuentaId: "701", glosa: "Venta", debe: 0, haber: 10.13 },
    ]
  );
});
test("recepciones validan comprobante, condición de pago y estructura de líneas", () => {
  assert.equal(esTipoComprobanteRecepcionValido("01"), true);
  assert.equal(esTipoComprobanteRecepcionValido("99"), false);
  assert.equal(sonDiasCreditoRecepcionValidos(0), true);
  assert.equal(sonDiasCreditoRecepcionValidos(15), true);
  assert.equal(sonDiasCreditoRecepcionValidos(30), true);
  assert.equal(sonDiasCreditoRecepcionValidos(15.5), false);
  assert.equal(sonDiasCreditoRecepcionValidos(-15), false);
  assert.equal(sonDiasCreditoRecepcionValidos(Number.NaN), false);
  assert.equal(normalizarLineasRecepcionCompra({}), null);
  assert.deepEqual(normalizarLineasRecepcionCompra([null, "línea", { detalleId: "", cantidad: 2 }]), []);
  assert.deepEqual(
    normalizarLineasRecepcionCompra([
      { detalleId: "detalle-1", cantidad: 2, costoUnitario: 5.5, numeroLoteProveedor: "L-1" },
      { detalleId: "detalle-2", cantidad: 0, costoUnitario: 4 },
      { detalleId: "detalle-3", cantidad: 1, costoUnitario: "alterado", numeroLoteProveedor: 123 },
    ]),
    [
      { detalleId: "detalle-1", cantidad: 2, costoUnitario: 5.5, numeroLoteProveedor: "L-1" },
      { detalleId: "detalle-3", cantidad: 1, costoUnitario: Number.NaN, numeroLoteProveedor: undefined },
    ]
  );
});
test("tasas de planilla aceptan únicamente porcentajes finitos entre 0 y 100", () => {
  assert.equal(esPorcentajePlanillaValido(0), true);
  assert.equal(esPorcentajePlanillaValido(13), true);
  assert.equal(esPorcentajePlanillaValido(100), true);
  assert.equal(esPorcentajePlanillaValido(-0.01), false);
  assert.equal(esPorcentajePlanillaValido(100.01), false);
  assert.equal(esPorcentajePlanillaValido(Number.NaN), false);
  assert.equal(esPorcentajePlanillaValido(Number.POSITIVE_INFINITY), false);
});

test("un registro maestro solo pertenece a su compañía activa", () => {
  assert.equal(perteneceAEmpresaActiva({ empresaId: "empresa-1" }, "empresa-1"), true);
  assert.equal(perteneceAEmpresaActiva({ empresaId: "empresa-2" }, "empresa-1"), false);
  assert.equal(perteneceAEmpresaActiva(null, "empresa-1"), false);
});

test("la compañía activa ignora cookies manipuladas por usuarios no administradores", () => {
  assert.equal(
    empresaSolicitadaPermitida({ rol: "VENTAS", empresaId: "empresa-asignada" }, "empresa-ajena"),
    "empresa-asignada"
  );
  assert.equal(
    empresaSolicitadaPermitida({ rol: "ADMIN", empresaId: "empresa-principal" }, "empresa-activa"),
    "empresa-activa"
  );
  assert.equal(
    empresaSolicitadaPermitida({ rol: "ADMIN", empresaId: "empresa-principal" }, undefined),
    "empresa-principal"
  );
});

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

test("proyecciones aceptan únicamente años y trimestres enteros dentro del rango operativo", () => {
  assert.equal(esPeriodoProyeccionValido(2026, 1), true);
  assert.equal(esPeriodoProyeccionValido(2100, 4), true);
  assert.equal(esPeriodoProyeccionValido(1999, 1), false);
  assert.equal(esPeriodoProyeccionValido(2101, 4), false);
  assert.equal(esPeriodoProyeccionValido(2026.5, 2), false);
  assert.equal(esPeriodoProyeccionValido(2026, 0), false);
  assert.equal(esPeriodoProyeccionValido(2026, 5), false);
});

test("simulador de proyecciones rechaza líneas duplicadas y precios manipulados", () => {
  assert.deepEqual(
    validarLineasSimulacion([
      { detalleId: "detalle-1", precioSimulado: 12.5, precioCompetidorRef: null },
    ]),
    {
      lineas: [{ detalleId: "detalle-1", precioSimulado: 12.5, precioCompetidorRef: null }],
    }
  );
  assert.ok(
    "error" in
      validarLineasSimulacion([
        { detalleId: "detalle-1", precioSimulado: 12.5, precioCompetidorRef: null },
        { detalleId: "detalle-1", precioSimulado: 13, precioCompetidorRef: null },
      ])
  );
  assert.ok(
    "error" in
      validarLineasSimulacion([
        { detalleId: "detalle-1", precioSimulado: -1, precioCompetidorRef: null },
      ])
  );
  assert.ok(
    "error" in
      validarLineasSimulacion([
        { detalleId: "detalle-1", precioSimulado: Number.POSITIVE_INFINITY, precioCompetidorRef: null },
      ])
  );
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

  await Promise.all(
    Array.from({ length: 5 }, (_, intento) =>
      registrarIntentoFallidoLogin(usuario.id, new Date(ahora.getTime() + intento * 1000))
    )
  );

  const bloqueado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
  assert.equal(bloqueado.intentosFallidos, 5);
  assert.ok(bloqueado.bloqueadoHasta);
  assert.ok(bloqueado.bloqueadoHasta.getTime() >= ahora.getTime() + DURACION_BLOQUEO_LOGIN_MS);
  assert.ok(
    bloqueado.bloqueadoHasta.getTime() <=
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
test("aprobación de crédito solo se reutiliza para la evaluación exacta", () => {
  const decimal = (valor: number) => ({ toNumber: () => valor });
  const aprobada = {
    estadoAprobacionCredito: "APROBADA" as const,
    condicionPagoCredito: "DIAS_30" as const,
    deudaCreditoEvaluada: decimal(800),
    montoCreditoEvaluado: decimal(300),
    limiteCreditoEvaluado: decimal(1000),
  };
  const actual = { condicionPago: "DIAS_30" as const, deudaActual: 800, montoFactura: 300, limite: 1000 };

  assert.equal(esAprobacionCreditoVigente(aprobada, actual), true);
  assert.equal(esAprobacionCreditoVigente({ ...aprobada, estadoAprobacionCredito: "RECHAZADA" }, actual), false);
  assert.equal(esAprobacionCreditoVigente(aprobada, { ...actual, condicionPago: "DIAS_15" }), false);
  assert.equal(esAprobacionCreditoVigente(aprobada, { ...actual, deudaActual: 801 }), false);
  assert.equal(esAprobacionCreditoVigente(aprobada, { ...actual, montoFactura: 301 }), false);
  assert.equal(esAprobacionCreditoVigente(aprobada, { ...actual, limite: 1100 }), false);
});
test("permisos de grupo restringen la lectura financiera sin limitar al administrador", async () => {
  const [gerencia, administrador, grupo] = await Promise.all([
    prisma.usuario.findFirstOrThrow({ where: { rol: "GERENCIA", activo: true } }),
    prisma.usuario.findFirstOrThrow({ where: { rol: "ADMIN", activo: true } }),
    prisma.grupoSeguridad.create({
      data: {
        codigo: "TEST-SIN-FINANZAS",
        nombre: "Prueba sin lectura financiera",
        permisos: {
          create: [
            { modulo: "finanzas", puedeVer: false },
            { modulo: "rrhh", puedeCrear: false },
          ],
        },
      },
    }),
  ]);

  assert.equal(await puedeRealizar({ ...gerencia, grupoSeguridadId: grupo.id }, "finanzas", "ver"), false);
  assert.equal(await puedeRealizar({ ...gerencia, grupoSeguridadId: grupo.id }, "rrhh", "crear"), false);
  assert.equal(await puedeRealizar(administrador, "finanzas", "ver"), true);

  const predefinido = await prisma.grupoSeguridad.findFirstOrThrow({
    where: { esPredefinido: true },
  });
  assert.equal(await existeGrupoSeguridadAsignable(null), true);
  assert.equal(await existeGrupoSeguridadAsignable(grupo.id), true);
  assert.equal(await existeGrupoSeguridadAsignable(predefinido.id), false);
  assert.equal(await existeGrupoSeguridadAsignable("grupo-inexistente"), false);
  await prisma.grupoSeguridad.update({ where: { id: grupo.id }, data: { activo: false } });
  assert.equal(await existeGrupoSeguridadAsignable(grupo.id), false);
});
test("aprobaciones separan al solicitante de quien resuelve", () => {
  assert.equal(puedeResolverSolicitud("usuario-solicitante", "usuario-gerencia"), true);
  assert.equal(puedeResolverSolicitud("usuario-solicitante", "usuario-solicitante"), false);
});
test("secretos de configuración solo se reemplazan con un valor nuevo", () => {
  assert.equal(resolverSecretoFormulario("", "secreto-existente"), "secreto-existente");
  assert.equal(resolverSecretoFormulario("   ", "secreto-existente"), "secreto-existente");
  assert.equal(resolverSecretoFormulario(" nuevo ", "secreto-existente"), "nuevo");
  assert.equal(resolverSecretoFormulario("", null), null);
});

test("enums runtime rechazan valores manipulados fuera de Prisma", () => {
  const tiposDireccion = Object.values(TipoDireccion);
  assert.equal(esValorEnum(tiposDireccion, "FACTURACION"), true);
  assert.equal(esValorEnum(tiposDireccion, "ENVIO"), true);
  assert.equal(esValorEnum(tiposDireccion, "OTRA"), true);
  assert.equal(esValorEnum(tiposDireccion, "DIRECCION_INVENTADA"), false);
  assert.equal(esValorEnum(tiposDireccion, ""), false);
  assert.equal(esValorEnum(Object.values(Afp), "INTEGRA"), true);
  assert.equal(esValorEnum(Object.values(Afp), "AFP_INVENTADA"), false);
  assert.equal(esValorEnum(Object.values(TipoComisionAfp), "MIXTA"), true);
  assert.equal(esValorEnum(Object.values(TipoComisionAfp), "COMISION_INVENTADA"), false);
});

test("PLE acepta únicamente años y meses enteros dentro del rango operativo", () => {
  assert.equal(esPeriodoPLEValido(2026, 1), true);
  assert.equal(esPeriodoPLEValido(2100, 12), true);
  assert.equal(esPeriodoPLEValido(1999, 1), false);
  assert.equal(esPeriodoPLEValido(2101, 1), false);
  assert.equal(esPeriodoPLEValido(2026.5, 1), false);
  assert.equal(esPeriodoPLEValido(2026, 0), false);
  assert.equal(esPeriodoPLEValido(2026, 13), false);
});

test("PLE neutraliza separadores y saltos dentro de campos maestros", () => {
  assert.equal(sanitizarCampoPLE("Proveedor|inyectado\r\nsegunda fila"), "Proveedor inyectado segunda fila");
  assert.equal(
    generarArchivoPLE([["campo-1", "Razón|Social\nAlterada", "campo-3"]]),
    "campo-1|Razón Social Alterada|campo-3"
  );
});

test("CSV neutraliza fórmulas y conserva el escape estructural", () => {
  assert.equal(
    escaparCeldaCsv("=HYPERLINK(\"https://ejemplo\")"),
    "\"'=HYPERLINK(\"\"https://ejemplo\"\")\""
  );
  assert.equal(escaparCeldaCsv("+SUM(A1:A2)"), "'+SUM(A1:A2)");
  assert.equal(escaparCeldaCsv("@comando"), "'@comando");
  assert.equal(escaparCeldaCsv("Banco, Cuenta"), "\"Banco, Cuenta\"");
  assert.equal(escaparCeldaCsv("Texto normal"), "Texto normal");
});

test("adjuntos aceptan únicamente tipos de entidad registrados", () => {
  assert.equal(esTipoEntidadAdjunto("OrdenCompra"), true);
  assert.equal(esTipoEntidadAdjunto("Empleado"), true);
  assert.equal(esTipoEntidadAdjunto("EntidadInventada"), false);
  assert.equal(esTipoEntidadAdjunto(""), false);
});
test("adjuntos de clientes respetan la compañía activa", async () => {
  const cliente = await prisma.cliente.findFirstOrThrow({
    select: { id: true, empresaId: true },
  });
  assert.equal(await existeEntidadAdjunto("Cliente", cliente.id, cliente.empresaId), true);
  assert.equal(await existeEntidadAdjunto("Cliente", cliente.id, "empresa-ajena"), false);
  assert.equal(await existeEntidadAdjunto("Cliente", cliente.id), false);
});
test("rutas de adjuntos permanecen dentro de su directorio físico", () => {
  assert.equal(
    resolverRutaAdjunto("archivo-seguro.pdf"),
    resolve(DIRECTORIO_ADJUNTOS, "archivo-seguro.pdf")
  );
  assert.equal(resolverRutaAdjunto("../fuera.pdf"), null);
  assert.equal(resolverRutaAdjunto("subdirectorio/fuera.pdf"), null);
  assert.equal(resolverRutaAdjunto(resolve(tmpdir(), "fuera.pdf")), null);
  assert.equal(resolverRutaAdjunto(""), null);
});
test("descargas de adjuntos impiden detectar contenido y almacenar respuestas privadas", async () => {
  const ruta = await readFile(
    resolve(process.cwd(), "src/app/api/adjuntos/[id]/route.ts"),
    "utf8"
  );
  assert.match(ruta, /"X-Content-Type-Options": "nosniff"/);
  assert.match(ruta, /"Cache-Control": "private, no-store"/);
});

test("una fase EDT solo puede imputarse a su propio proyecto", () => {
  assert.equal(edtPerteneceAProyecto({ proyectoId: "proyecto-a" }, "proyecto-a"), true);
  assert.equal(edtPerteneceAProyecto({ proyectoId: "proyecto-b" }, "proyecto-a"), false);
  assert.equal(edtPerteneceAProyecto(null, "proyecto-a"), false);
});

test("proyectos no reutilizan códigos locales después de eliminar filas intermedias", () => {
  assert.equal(siguienteCodigoActividad(["A-01", "A-03"]), "A-04");
  assert.equal(siguienteCodigoActividad([]), "A-01");
  assert.equal(siguienteCodigoEdt(["1", "3"], null), "4");
  assert.equal(siguienteCodigoEdt(["2.1", "2.3", "20.9"], "2"), "2.4");
});

test("Server Actions solo amplían orígenes explícitamente en producción", () => {
  assert.deepEqual(obtenerOrigenesServerActions({ NODE_ENV: "production" }), []);
  assert.deepEqual(obtenerOrigenesServerActions({ NODE_ENV: "development" }), [
    "*.app.github.dev",
    "localhost:3000",
  ]);
  assert.deepEqual(
    obtenerOrigenesServerActions({
      NODE_ENV: "production",
      SERVER_ACTIONS_ALLOWED_ORIGINS: "erp.example.com, proxy.example.com,erp.example.com",
    }),
    ["erp.example.com", "proxy.example.com"]
  );
});

test("certificados SUNAT limitan extensión y tamaño antes de leer el contenido", () => {
  assert.equal(validarArchivoCertificadoSunat({ name: "firma.pfx", size: 1024 }), null);
  assert.equal(validarArchivoCertificadoSunat({ name: "firma.P12", size: 1024 }), null);
  assert.match(
    validarArchivoCertificadoSunat({ name: "firma.pdf", size: 1024 }) ?? "",
    /\.pfx o \.p12/
  );
  assert.match(
    validarArchivoCertificadoSunat({
      name: "firma.pfx",
      size: TAMANIO_MAXIMO_CERTIFICADO_SUNAT + 1,
    }) ?? "",
    /2 MB/
  );
});

test("costo promedio pondera el stock previo y la entrada", () => {
  assert.equal(calcularCostoPromedioEntrada(100, 4, 20, 7), 4.5);
  assert.equal(calcularCostoPromedioEntrada(0, 0, 20, 7), 7);
});
