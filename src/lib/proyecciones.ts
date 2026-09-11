import { prisma } from "@/lib/prisma";
import { ajustarCantidadCompra, calcularCompraNeta } from "@/lib/reservasProduccion";
import { horasDisponiblesEnRango, type ResumenCalendario } from "@/lib/calendarioProduccion";

// ---------------------------------------------------------------------------
// Motor de proyecciones trimestrales (Marketing / Operaciones / Finanzas).
// Adaptado de la metodología del Business Management Game (estacionalidad +
// estimaciones cualitativas + cascada de financiamiento) a los datos reales
// de esta empresa: sin simular competidores, la estacionalidad sale de la
// propia historia de ventas y el resto de supuestos los ingresa el usuario.
// ---------------------------------------------------------------------------

export function trimestreDe(fecha: Date): { anio: number; trimestre: number } {
  return { anio: fecha.getFullYear(), trimestre: Math.floor(fecha.getMonth() / 3) + 1 };
}

export function esPeriodoProyeccionValido(anio: number, trimestre: number): boolean {
  return (
    Number.isInteger(anio) &&
    anio >= 2000 &&
    anio <= 2100 &&
    Number.isInteger(trimestre) &&
    trimestre >= 1 &&
    trimestre <= 4
  );
}

export function rangoTrimestre(anio: number, trimestre: number): { inicio: Date; fin: Date } {
  const mesInicio = (trimestre - 1) * 3;
  return { inicio: new Date(anio, mesInicio, 1), fin: new Date(anio, mesInicio + 3, 1) };
}

// Trimestre anterior al (anio, trimestre) dado.
export function trimestreAnterior(anio: number, trimestre: number): { anio: number; trimestre: number } {
  return trimestre === 1 ? { anio: anio - 1, trimestre: 4 } : { anio, trimestre: trimestre - 1 };
}

/** Unidades vendidas por presentación, agrupadas por "año-trimestre", de toda la historia (facturas no anuladas). */
export async function ventasHistoricasPorTrimestre(empresaId: string): Promise<Map<string, Map<string, number>>> {
  const facturas = await prisma.factura.findMany({
    where: { empresaId, estado: { not: "ANULADA" } },
    include: { detalles: true },
  });
  const mapa = new Map<string, Map<string, number>>();
  for (const f of facturas) {
    const { anio, trimestre } = trimestreDe(f.fechaEmision);
    const clave = `${anio}-${trimestre}`;
    for (const d of f.detalles) {
      const porPresentacion = mapa.get(d.presentacionId) ?? new Map<string, number>();
      porPresentacion.set(clave, (porPresentacion.get(clave) ?? 0) + d.cantidad);
      mapa.set(d.presentacionId, porPresentacion);
    }
  }
  return mapa;
}

/**
 * Índice de estacionalidad de una presentación: promedio de unidades del
 * trimestre objetivo (en años anteriores) ÷ promedio de unidades del
 * trimestre base (mismos años). null si no hay al menos un año de historia
 * para poder compararlos (se debe ingresar manualmente en ese caso).
 */
export function calcularIndiceEstacionalidad(
  historicoPresentacion: Map<string, number> | undefined,
  trimestreObjetivo: number,
  trimestreBase: number
): number | null {
  if (!historicoPresentacion) return null;
  const valoresObjetivo: number[] = [];
  const valoresBase: number[] = [];
  for (const [clave, unidades] of historicoPresentacion) {
    const trimestre = Number(clave.split("-")[1]);
    if (trimestre === trimestreObjetivo) valoresObjetivo.push(unidades);
    if (trimestre === trimestreBase) valoresBase.push(unidades);
  }
  if (valoresObjetivo.length === 0 || valoresBase.length === 0) return null;
  const promedio = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const base = promedio(valoresBase);
  if (base <= 0) return null;
  return promedio(valoresObjetivo) / base;
}

export type DetalleCalculado = {
  presentacionId: string;
  nombre: string;
  productoId: string;
  contenidoKg: number;
  precio: number;
  costoPromedio: number;
  stock: number;
  stockReservado: number;
  stockMinimo: number;
  ventasBase: number;
  indiceEstacionalidad: number;
  sinHistorico: boolean;
  ajusteCualitativoPct: number;
  demandaProyectada: number;
  ventasProyectadas: number;
};

/** Aplica los supuestos (globales + por presentación) sobre los datos base y devuelve la demanda/ventas proyectadas. */
export function calcularDemanda(
  detalles: {
    presentacionId: string;
    nombre: string;
    productoId: string;
    contenidoKg: number;
    precio: number;
    costoPromedio: number;
    stock: number;
    stockReservado: number;
    stockMinimo: number;
    ventasBase: number;
    indiceEstacionalidad: number;
    sinHistorico: boolean;
    ajusteCualitativoPct: number;
  }[],
  crecimientoMercadoPct: number,
  factorCompetenciaPct: number
): DetalleCalculado[] {
  return detalles.map((d) => {
    const demandaProyectada =
      d.ventasBase *
      d.indiceEstacionalidad *
      (1 + crecimientoMercadoPct / 100) *
      (1 + factorCompetenciaPct / 100) *
      (1 + d.ajusteCualitativoPct / 100);
    return { ...d, demandaProyectada, ventasProyectadas: demandaProyectada * d.precio };
  });
}

export type NecesidadInsumo = {
  insumoId: string;
  nombre: string;
  unidadMedida: string;
  costoUnitario: number;
  stock: number;
  stockMinimo: number;
  stockReservadoProduccion: number;
  consumoProyectado: number;
  necesidadNeta: number;
  aComprar: number;
  plazoEntregaDias: number;
  cantidadMinimaCompra: number;
  multiploCompra: number;
};

export type ResultadoOperaciones = {
  kgGranelTotal: number;
  costoProduccionProyectado: number;
  horasHombreProyectadas: number;
  horasHombreDisponibles: number;
  capacidadPorAlmacen: ResumenCalendario[];
  insumos: NecesidadInsumo[];
  presentacionesSinFormula: string[];
  demandaNeteada: DemandaNeteadaPresentacion[];
};

export type DemandaNeteadaPresentacion = {
  presentacionId: string;
  nombre: string;
  pronostico: number;
  pedidosFirmes: number;
  demandaPlanificada: number;
};

export function calcularDemandaPlanificada(pronostico: number, pedidosFirmes: number): number {
  return Math.max(0, pronostico, pedidosFirmes);
}

export function calcularSaldoPedido(
  cantidadPedida: number,
  facturas: readonly { cantidad: number; anulada: boolean }[],
): number {
  const facturadoVigente = facturas
    .filter((factura) => !factura.anulada)
    .reduce((total, factura) => total + factura.cantidad, 0);
  return Math.max(0, cantidadPedida - facturadoVigente);
}

export function calcularUnidadesAProducir(detalle: {
  demandaPlanificada: number;
  stock: number;
  stockMinimo: number;
}): number {
  return Math.max(0, detalle.demandaPlanificada + detalle.stockMinimo - detalle.stock);
}

/**
 * Plan de producción: para cada presentación con demanda proyectada, cubre el
 * faltante contra stock disponible (físico menos reservado, con stock mínimo como colchón) y consume la fórmula
 * activa más reciente del producto para estimar insumos, costo y mano de obra.
 * La capacidad disponible sale del calendario de producción de los almacenes
 * (Configuración → Almacenes) para el rango de fechas del trimestre proyectado.
 */
/**
 * MRP. Con `almacenId` se planifica para UNA planta: el neteo usa el stock de
 * esa planta y solo su demanda firme.
 *
 * El pronóstico queda fuera cuando se planifica por planta, a propósito:
 * `Proyeccion` no tiene dimensión de planta, así que repartirlo entre plantas
 * exigiría un criterio de asignación que es una decisión del negocio. Suponerlo
 * daría un número plausible y equivocado, que es peor que no darlo.
 *
 * Sin `almacenId` el comportamiento es el de siempre: compañía completa.
 */
export async function calcularOperaciones(
  detalles: DetalleCalculado[],
  anio: number,
  trimestre: number,
  empresaId: string,
  almacenId?: string | null,
): Promise<ResultadoOperaciones> {
  const { inicio, fin } = rangoTrimestre(anio, trimestre);
  const { total: horasTodas, porAlmacen: capacidadTodas } = await horasDisponiblesEnRango(
    inicio,
    fin,
    empresaId,
  );
  const capacidadPorAlmacen = almacenId
    ? capacidadTodas.filter((a) => a.almacenId === almacenId)
    : capacidadTodas;
  const horasHombreDisponibles = almacenId
    ? capacidadPorAlmacen.reduce((acc, a) => acc + a.horasDisponibles, 0)
    : horasTodas;

  // Stock de la planta: SaldoAlmacen en vez del agregado de la compañía.
  // Un ítem sin saldo en esa planta cuenta como cero, no como el stock total.
  const saldosPlanta = almacenId
    ? await prisma.saldoAlmacen.findMany({ where: { almacenId } })
    : [];
  const stockPlantaPresentacion = new Map<string, number>();
  const stockPlantaInsumo = new Map<string, number>();
  for (const saldo of saldosPlanta) {
    if (saldo.presentacionId) {
      stockPlantaPresentacion.set(saldo.presentacionId, saldo.cantidad.toNumber());
    } else if (saldo.insumoId) {
      stockPlantaInsumo.set(saldo.insumoId, saldo.cantidad.toNumber());
    }
  }
  const stockDePresentacion = (presentacionId: string, agregado: number) =>
    almacenId ? (stockPlantaPresentacion.get(presentacionId) ?? 0) : agregado;
  const stockDeInsumo = (insumoId: string, agregado: number) =>
    almacenId ? (stockPlantaInsumo.get(insumoId) ?? 0) : agregado;
  const backlog = await prisma.pedidoDetalle.findMany({
    where: {
      pedido: {
        empresaId,
        ...(almacenId ? { almacenId } : {}),
        estado: { in: ["PENDIENTE", "PARCIAL"] },
        OR: [{ fechaEntregaSolicitada: null }, { fechaEntregaSolicitada: { lt: fin } }],
      },
    },
    include: {
      presentacion: { include: { producto: true } },
      facturaDetalles: { include: { factura: { select: { estado: true } } } },
    },
  });
  const pedidosFirmesPorPresentacion = new Map<string, number>();
  const detallePorPresentacion = new Map(detalles.map((detalle) => [detalle.presentacionId, detalle]));
  for (const linea of backlog) {
    const pendiente = calcularSaldoPedido(
      linea.cantidad,
      linea.facturaDetalles.map((detalle) => ({
        cantidad: detalle.cantidad,
        anulada: detalle.factura.estado === "ANULADA",
      })),
    );
    pedidosFirmesPorPresentacion.set(
      linea.presentacionId,
      (pedidosFirmesPorPresentacion.get(linea.presentacionId) ?? 0) + pendiente,
    );
    if (!detallePorPresentacion.has(linea.presentacionId)) {
      detallePorPresentacion.set(linea.presentacionId, {
        presentacionId: linea.presentacionId,
        nombre: `${linea.presentacion.producto.nombre} — ${linea.presentacion.nombre}`,
        productoId: linea.presentacion.productoId,
        contenidoKg: linea.presentacion.contenidoKg.toNumber(),
        precio: linea.presentacion.precio.toNumber(),
        costoPromedio: linea.presentacion.costoPromedio.toNumber(),
        stock: linea.presentacion.stock.toNumber(),
        stockReservado: linea.presentacion.stockReservado.toNumber(),
        stockMinimo: linea.presentacion.stockMinimo.toNumber(),
        ventasBase: 0,
        indiceEstacionalidad: 1,
        sinHistorico: true,
        ajusteCualitativoPct: 0,
        demandaProyectada: 0,
        ventasProyectadas: 0,
      });
    }
  }
  const detallesPlanificacion = [...detallePorPresentacion.values()];
  const demandaNeteada = detallesPlanificacion.map((detalle) => {
    const pedidosFirmes = pedidosFirmesPorPresentacion.get(detalle.presentacionId) ?? 0;
    const pronostico = almacenId ? 0 : detalle.demandaProyectada;
    return {
      presentacionId: detalle.presentacionId,
      nombre: detalle.nombre,
      pronostico,
      pedidosFirmes,
      demandaPlanificada: calcularDemandaPlanificada(pronostico, pedidosFirmes),
    };
  });
  const demandaPorPresentacion = new Map(demandaNeteada.map((demanda) => [demanda.presentacionId, demanda]));
  const todosProductoIds = [...new Set(detallesPlanificacion.map((d) => d.productoId))];
  const formulas = await prisma.formula.findMany({
    where: { empresaId, productoId: { in: todosProductoIds }, activo: true },
    include: { detalles: { include: { insumo: true } } },
    orderBy: { version: "desc" },
  });
  const reservas = await prisma.reservaInsumoProduccion.findMany({
    where: { loteGranel: { empresaId } },
    select: { insumoId: true, cantidad: true },
  });
  const reservaPorInsumo = new Map<string, number>();
  for (const reserva of reservas) {
    reservaPorInsumo.set(
      reserva.insumoId,
      (reservaPorInsumo.get(reserva.insumoId) ?? 0) + reserva.cantidad.toNumber(),
    );
  }
  const formulaPorProducto = new Map<string, (typeof formulas)[number]>();
  for (const f of formulas) {
    if (!formulaPorProducto.has(f.productoId)) formulaPorProducto.set(f.productoId, f);
  }

  // Eficiencia histórica (h-h por kg de granel), de lotes ya finalizados.
  const lotesFinalizados = await prisma.loteGranel.findMany({
    where: { empresaId, kgProducidos: { gt: 0 }, estado: { in: ["APROBADO", "RECHAZADO"] } },
  });
  const kgTotalHistorico = lotesFinalizados.reduce((acc, l) => acc + l.kgProducidos.toNumber(), 0);
  const horasTotalHistorico = lotesFinalizados.reduce((acc, l) => acc + l.horasManoObra.toNumber(), 0);
  const horasPorKg = kgTotalHistorico > 0 ? horasTotalHistorico / kgTotalHistorico : 0;

  let kgGranelTotal = 0;
  let costoProduccionProyectado = 0;
  const consumoPorInsumo = new Map<string, { insumo: (typeof formulas)[number]["detalles"][number]["insumo"]; cantidad: number }>();
  const presentacionesSinFormula: string[] = [];

  for (const d of detallesPlanificacion) {
    const demandaPlanificada = demandaPorPresentacion.get(d.presentacionId)?.demandaPlanificada ?? 0;
    if (demandaPlanificada <= 0) continue;
    const unidadesAProducir = calcularUnidadesAProducir({
      demandaPlanificada,
      stock: stockDePresentacion(d.presentacionId, d.stock),
      stockMinimo: d.stockMinimo,
    });
    if (unidadesAProducir <= 0) continue;
    const kgGranel = unidadesAProducir * d.contenidoKg;

    const formula = formulaPorProducto.get(d.productoId);
    if (!formula) {
      presentacionesSinFormula.push(d.nombre);
      continue;
    }
    kgGranelTotal += kgGranel;
    const factor = kgGranel / formula.rendimientoKg.toNumber();
    for (const fd of formula.detalles) {
      const cantidad = fd.cantidad.toNumber() * factor;
      const fila = consumoPorInsumo.get(fd.insumoId) ?? { insumo: fd.insumo, cantidad: 0 };
      fila.cantidad += cantidad;
      consumoPorInsumo.set(fd.insumoId, fila);
      costoProduccionProyectado += cantidad * fd.insumo.costoUnitario.toNumber();
    }
  }

  const insumos: NecesidadInsumo[] = [...consumoPorInsumo.values()].map(({ insumo, cantidad }) => {
    const stockInsumo = stockDeInsumo(insumo.id, insumo.stock.toNumber());
    const necesidadNeta = calcularCompraNeta(cantidad, insumo.stockMinimo.toNumber(), stockInsumo, reservaPorInsumo.get(insumo.id) ?? 0);
    return {
      insumoId: insumo.id,
      nombre: insumo.nombre,
      unidadMedida: insumo.unidadMedida,
      costoUnitario: insumo.costoUnitario.toNumber(),
      stock: stockInsumo,
      stockMinimo: insumo.stockMinimo.toNumber(),
      stockReservadoProduccion: reservaPorInsumo.get(insumo.id) ?? 0,
      consumoProyectado: cantidad,
      necesidadNeta,
      plazoEntregaDias: insumo.plazoEntregaDias,
      cantidadMinimaCompra: insumo.cantidadMinimaCompra.toNumber(),
      multiploCompra: insumo.multiploCompra.toNumber(),
      aComprar: ajustarCantidadCompra(necesidadNeta, insumo.cantidadMinimaCompra.toNumber(), insumo.multiploCompra.toNumber()),
    };
  });

  return {
    kgGranelTotal,
    costoProduccionProyectado,
    horasHombreProyectadas: kgGranelTotal * horasPorKg,
    horasHombreDisponibles,
    capacidadPorAlmacen,
    insumos,
    presentacionesSinFormula,
    demandaNeteada,
  };
}

export type LineaFinanciamiento = { etiqueta: string; monto: number; tasa: number };

export type ResultadoFinanzas = {
  ventasProyectadas: number;
  costoVentasProyectado: number;
  utilidadBruta: number;
  comisionesProyectadas: number;
  tasaComisionPromedio: number;
  gastosOperativosProyectados: number;
  utilidadOperativa: number;
  cajaActual: number;
  cxcPorVencer: number;
  cxpPorVencer: number;
  flujoCajaProyectado: number;
  necesidadFinanciamiento: number;
  cascada: LineaFinanciamiento[];
};

export async function calcularFinanzas(
  detalles: DetalleCalculado[],
  presupuestoPublicidad: number,
  cajaMinimaDeseada: number,
  anio: number,
  trimestre: number,
  empresaId: string,
): Promise<ResultadoFinanzas> {
  const config = await prisma.configuracionEmpresa.findUniqueOrThrow({ where: { id: "1" } });
  const { inicio, fin } = rangoTrimestre(anio, trimestre);

  const ventasProyectadas = detalles.reduce((acc, d) => acc + d.ventasProyectadas, 0);
  // Costo de ventas: al costo promedio vigente de cada presentación (el costo
  // de la nueva producción todavía no está confirmado).
  const costoVentasProyectado = detalles.reduce(
    (acc, d) => acc + d.demandaProyectada * d.costoPromedio,
    0
  );

  const vendedoresActivos = await prisma.vendedor.findMany({ where: { empresaId, activo: true } });
  const tasaComisionPromedio =
    vendedoresActivos.length > 0
      ? vendedoresActivos.reduce((acc, v) => acc + v.tasaComision.toNumber(), 0) / vendedoresActivos.length / 100
      : 0;
  const comisionesProyectadas = ventasProyectadas * tasaComisionPromedio;

  // Gastos fijos: promedio histórico de egresos manuales de caja (hasta 4 trimestres).
  const movimientosManuales = await prisma.movimientoCaja.findMany({
    where: { empresaId, tipo: "EGRESO", referencia: null },
    orderBy: { fecha: "desc" },
    take: 200,
  });
  const trimestresConGasto = new Set(
    movimientosManuales.map((m) => {
      const t = trimestreDe(m.fecha);
      return `${t.anio}-${t.trimestre}`;
    })
  );
  const totalGastoManual = movimientosManuales.reduce((acc, m) => acc + m.monto.toNumber(), 0);
  const gastoFijoPromedio = trimestresConGasto.size > 0 ? totalGastoManual / trimestresConGasto.size : 0;
  const gastosOperativosProyectados = presupuestoPublicidad + gastoFijoPromedio;

  const utilidadBruta = ventasProyectadas - costoVentasProyectado;
  const utilidadOperativa = utilidadBruta - comisionesProyectadas - gastosOperativosProyectados;

  const [movimientosCaja, facturasPendientes, cuentasPorPagarPendientes] = await Promise.all([
    prisma.movimientoCaja.findMany({ where: { empresaId } }),
    prisma.factura.findMany({ where: { empresaId, estado: "PENDIENTE" } }),
    prisma.cuentaPorPagar.findMany({ where: { empresaId, estado: "PENDIENTE" } }),
  ]);
  const cajaActual = movimientosCaja.reduce(
    (acc, m) => acc + (m.tipo === "INGRESO" ? m.monto.toNumber() : -m.monto.toNumber()),
    0
  );
  const cxcPorVencer = facturasPendientes
    .filter((f) => f.fechaVencimiento >= inicio && f.fechaVencimiento < fin)
    .reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const cxpPorVencer = cuentasPorPagarPendientes
    .filter((c) => c.fechaVencimiento && c.fechaVencimiento >= inicio && c.fechaVencimiento < fin)
    .reduce((acc, c) => acc + c.saldo.toNumber(), 0);

  const flujoCajaProyectado = cajaActual + utilidadOperativa + cxcPorVencer - cxpPorVencer;
  const necesidadFinanciamiento = Math.max(0, cajaMinimaDeseada - flujoCajaProyectado);

  // Cascada de financiamiento: lo más barato/disponible primero.
  let restante = necesidadFinanciamiento;
  const descuentoCxC = Math.min(restante, Math.max(0, cxcPorVencer));
  restante -= descuentoCxC;
  const cortoPlazo = Math.min(restante, config.limiteCreditoCortoPlazo.toNumber());
  restante -= cortoPlazo;
  const largoPlazo = restante;

  const cascada: LineaFinanciamiento[] = [
    { etiqueta: "Descuento de cuentas por cobrar", monto: descuentoCxC, tasa: config.tasaDescuentoCxC.toNumber() },
    { etiqueta: "Crédito corto plazo", monto: cortoPlazo, tasa: config.tasaCreditoCortoPlazo.toNumber() },
    { etiqueta: "Crédito largo plazo", monto: largoPlazo, tasa: config.tasaCreditoLargoPlazo.toNumber() },
  ];

  return {
    ventasProyectadas,
    costoVentasProyectado,
    utilidadBruta,
    comisionesProyectadas,
    tasaComisionPromedio,
    gastosOperativosProyectados,
    utilidadOperativa,
    cajaActual,
    cxcPorVencer,
    cxpPorVencer,
    flujoCajaProyectado,
    necesidadFinanciamiento,
    cascada,
  };
}
