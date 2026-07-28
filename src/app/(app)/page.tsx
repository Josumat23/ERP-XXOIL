import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero, formatFecha } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import GraficoLinea from "@/components/GraficoLinea";
import BarraRanking from "@/components/BarraRanking";
import FichaTabs from "@/components/FichaTabs";

const MESES_TENDENCIA = 12;

// Base imponible de una factura (sin IGV); las antiguas sin desglose usan su total.
const baseFactura = (f: { subtotal: { toNumber(): number }; total: { toNumber(): number } }) =>
  f.subtotal.toNumber() > 0 ? f.subtotal.toNumber() : f.total.toNumber();

export default async function PanelPage() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioRango = new Date(hoy.getFullYear(), hoy.getMonth() - (MESES_TENDENCIA - 1), 1);

  const [
    facturasRango,
    facturasPendientes,
    comisiones,
    comisionesMes,
    notasCreditoMes,
    movimientosCajaManualesMes,
    lotesActivos,
    lotesFinalizadosMes,
    envasadosMes,
    presentaciones,
    insumos,
    pedidosPendientes,
    pedidosMes,
    cuentasPorPagarPendientes,
    asientoDetalles,
    clientesActivosCount,
    envasadosPorVencer,
    cotizacionesPorVencer,
    conteosRecientes,
    movimientosCasco,
    ordenesMantenimientoPendientes,
  ] = await Promise.all([
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" }, fechaEmision: { gte: inicioRango } },
      include: { cliente: true, vendedor: true, pedido: { include: { detalles: true } } },
    }),
    prisma.factura.findMany({
      where: { estado: "PENDIENTE" },
      include: { cliente: true },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.comision.findMany({ where: { estado: "PENDIENTE" } }),
    prisma.comision.findMany({ where: { creadoEn: { gte: inicioMes } } }),
    prisma.notaCredito.findMany({
      where: { fecha: { gte: inicioMes }, factura: { estado: { not: "ANULADA" } } },
      include: { factura: true },
    }),
    prisma.movimientoCaja.findMany({ where: { fecha: { gte: inicioMes }, referencia: null } }),
    prisma.loteGranel.findMany({
      where: { estado: { in: ["EN_PROCESO", "PENDIENTE_CALIDAD"] } },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "asc" },
    }),
    prisma.loteGranel.findMany({
      where: { estado: { in: ["APROBADO", "RECHAZADO"] }, fechaFin: { gte: inicioMes } },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaFin: "desc" },
    }),
    prisma.envasado.findMany({ where: { fecha: { gte: inicioMes } } }),
    prisma.presentacion.findMany({ where: { activo: true }, include: { producto: true } }),
    prisma.insumo.findMany({ where: { activo: true } }),
    prisma.pedido.count({ where: { estado: "PENDIENTE" } }),
    prisma.pedido.findMany({ where: { fecha: { gte: inicioMes } } }),
    prisma.cuentaPorPagar.findMany({ where: { estado: "PENDIENTE" }, include: { proveedor: true } }),
    prisma.asientoDetalle.findMany({ include: { cuenta: true } }),
    prisma.cliente.count({ where: { activo: true } }),
    prisma.envasado.findMany({
      where: {
        unidadesDisponibles: { gt: 0 },
        fechaVencimiento: { lte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 60) },
      },
      include: { presentacion: { include: { producto: true } } },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.cotizacion.findMany({
      where: {
        estado: "PENDIENTE",
        validaHasta: { lte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7) },
      },
      include: { cliente: true },
      orderBy: { validaHasta: "asc" },
    }),
    prisma.conteoInventario.findMany({
      where: { fecha: { gte: new Date(hoy.getFullYear(), hoy.getMonth() - 2, hoy.getDate()) } },
      include: { detalles: { include: { presentacion: true, insumo: true } } },
      orderBy: { fecha: "desc" },
    }),
    prisma.movimientoCasco.findMany({ include: { insumo: true } }),
    prisma.ordenMantenimiento.findMany({
      where: { estado: { in: ["PROGRAMADA", "EN_PROCESO"] } },
      include: { equipo: true },
      orderBy: { fechaProgramada: "asc" },
    }),
  ]);

  // Conteos con diferencia grande (posible merma/robo): >= 10% del saldo del
  // sistema, o stock encontrado donde el sistema no tenía nada.
  const diferenciasGrandes = conteosRecientes.flatMap((c) =>
    c.detalles
      .filter((d) => {
        const sistema = d.cantidadSistema.toNumber();
        const diferencia = Math.abs(d.diferencia.toNumber());
        if (diferencia <= 0) return false;
        return sistema > 0 ? diferencia / sistema >= 0.1 : true;
      })
      .map((d) => ({
        conteoCodigo: c.codigo,
        nombreItem: d.tipoItem === "PRESENTACION" ? d.presentacion?.nombre ?? "" : d.insumo?.nombre ?? "",
        diferencia: d.diferencia.toNumber(),
      }))
  );

  // Depósito total comprometido en cascos: neto (ENTREGADO − DEVUELTO) por
  // insumo retornable, sin desglosar por cliente (esto es solo el KPI).
  const netoCascoPorInsumo = new Map<string, number>();
  for (const m of movimientosCasco) {
    const actual = netoCascoPorInsumo.get(m.insumoId) ?? 0;
    netoCascoPorInsumo.set(m.insumoId, actual + (m.tipo === "ENTREGADO" ? m.cantidad : -m.cantidad));
  }
  const totalDepositoCascos = movimientosCasco.reduce((acc, m) => {
    const neto = netoCascoPorInsumo.get(m.insumoId) ?? 0;
    netoCascoPorInsumo.set(m.insumoId, 0); // ya contado, no duplicar por cada movimiento del mismo insumo
    return acc + Math.max(0, neto) * (m.insumo.montoDeposito?.toNumber() ?? 0);
  }, 0);

  const mantenimientoVencido = ordenesMantenimientoPendientes.filter(
    (o) => o.fechaProgramada < hoy
  );

  // ---------------------------------------------------------------------
  // Tendencia de ventas: un balde por mes (los últimos MESES_TENDENCIA, el
  // actual incluido) con ventas netas de IGV y su costo de ventas.
  // ---------------------------------------------------------------------
  const baldesMes = Array.from({ length: MESES_TENDENCIA }, (_, i) => {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (MESES_TENDENCIA - 1 - i), 1);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    return { inicio, fin, total: 0, costo: 0 };
  });
  for (const f of facturasRango) {
    const balde = baldesMes.find((b) => f.fechaEmision >= b.inicio && f.fechaEmision < b.fin);
    if (balde) {
      balde.total += baseFactura(f);
      balde.costo += f.pedido.detalles.reduce(
        (acc, d) => acc + d.cantidad * d.costoUnitario.toNumber(),
        0
      );
    }
  }
  const ventasPorMes = baldesMes.map((b) => ({
    etiqueta: new Intl.DateTimeFormat("es-PE", { month: "short" }).format(b.inicio).replace(".", ""),
    valor: b.total,
  }));

  const facturasMes = facturasRango.filter((f) => f.fechaEmision >= inicioMes);
  const ventasMes = baldesMes[baldesMes.length - 1].total;
  const ventasMesAnterior = baldesMes.length > 1 ? baldesMes[baldesMes.length - 2].total : 0;
  const deltaVentas =
    ventasMesAnterior > 0 ? ((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100 : null;

  const costoMes = baldesMes[baldesMes.length - 1].costo;
  const costoMesAnterior = baldesMes.length > 1 ? baldesMes[baldesMes.length - 2].costo : 0;
  const margenMes = ventasMes > 0 ? ((ventasMes - costoMes) / ventasMes) * 100 : null;
  const margenMesAnterior =
    ventasMesAnterior > 0 ? ((ventasMesAnterior - costoMesAnterior) / ventasMesAnterior) * 100 : null;
  const deltaMargen =
    margenMes !== null && margenMesAnterior !== null ? margenMes - margenMesAnterior : null;

  // Top 5 clientes y top 5 vendedores del mes por ventas.
  const ventasPorCliente = new Map<string, { nombre: string; total: number }>();
  const ventasPorVendedor = new Map<string, { nombre: string; total: number }>();
  for (const f of facturasMes) {
    const filaCliente = ventasPorCliente.get(f.clienteId) ?? { nombre: f.cliente.razonSocial, total: 0 };
    filaCliente.total += baseFactura(f);
    ventasPorCliente.set(f.clienteId, filaCliente);

    const filaVendedor = ventasPorVendedor.get(f.vendedorId) ?? { nombre: f.vendedor.nombre, total: 0 };
    filaVendedor.total += baseFactura(f);
    ventasPorVendedor.set(f.vendedorId, filaVendedor);
  }
  const topClientes = [...ventasPorCliente.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  const maxCliente = Math.max(...topClientes.map((c) => c.total), 1);
  const topVendedores = [...ventasPorVendedor.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  const maxVendedor = Math.max(...topVendedores.map((v) => v.total), 1);

  const cuentasPorCobrar = facturasPendientes.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const facturasVencidas = facturasPendientes.filter(
    (f) => f.fechaVencimiento < hoy && f.saldo.toNumber() > 0
  );
  const comisionesPendientes = comisiones.reduce((acc, c) => acc + c.monto.toNumber(), 0);

  const presentacionesBajoMinimo = presentaciones.filter(
    (p) => p.stock.toNumber() < p.stockMinimo.toNumber()
  );
  const insumosBajoMinimo = insumos.filter((i) => i.stock.toNumber() < i.stockMinimo.toNumber());

  // Valor de inventario a costo (producto terminado + insumos).
  const valorInventarioPT = presentaciones.reduce(
    (acc, p) => acc + p.stock.toNumber() * p.costoPromedio.toNumber(),
    0
  );
  const valorInventarioInsumos = insumos.reduce(
    (acc, i) => acc + i.stock.toNumber() * i.costoUnitario.toNumber(),
    0
  );
  const valorInventario = valorInventarioPT + valorInventarioInsumos;

  // ---------------------------------------------------------------------
  // Finanzas: estado de resultados del mes (misma fórmula que /finanzas/resultados)
  // ---------------------------------------------------------------------
  const totalNC = notasCreditoMes.reduce(
    (acc, nc) => acc + nc.monto.toNumber() / (1 + nc.factura.tasaIgv.toNumber() / 100),
    0
  );
  const ventasNetas = ventasMes - totalNC;
  const utilidadBruta = ventasNetas - costoMes;
  const comisionesNetas = comisionesMes.reduce((acc, c) => acc + c.monto.toNumber(), 0);
  const gastosOperativos = movimientosCajaManualesMes
    .filter((m) => m.tipo === "EGRESO")
    .reduce((acc, m) => acc + m.monto.toNumber(), 0);
  const otrosIngresos = movimientosCajaManualesMes
    .filter((m) => m.tipo === "INGRESO")
    .reduce((acc, m) => acc + m.monto.toNumber(), 0);
  const utilidadOperativa = utilidadBruta - comisionesNetas - gastosOperativos + otrosIngresos;

  const totalCuentasPorPagar = cuentasPorPagarPendientes.reduce((acc, c) => acc + c.saldo.toNumber(), 0);

  // Balance: Activo = Pasivo + Patrimonio, leído del libro mayor completo.
  type FilaTipo = { debe: number; haber: number };
  const porTipo: Record<string, FilaTipo> = {
    ACTIVO: { debe: 0, haber: 0 },
    PASIVO: { debe: 0, haber: 0 },
    PATRIMONIO: { debe: 0, haber: 0 },
    INGRESO: { debe: 0, haber: 0 },
    GASTO: { debe: 0, haber: 0 },
  };
  for (const d of asientoDetalles) {
    porTipo[d.cuenta.tipo].debe += d.debe.toNumber();
    porTipo[d.cuenta.tipo].haber += d.haber.toNumber();
  }
  const totalActivo = porTipo.ACTIVO.debe - porTipo.ACTIVO.haber;
  const totalPasivo = porTipo.PASIVO.haber - porTipo.PASIVO.debe;
  const resultadoAcumulado =
    porTipo.INGRESO.haber - porTipo.INGRESO.debe - (porTipo.GASTO.debe - porTipo.GASTO.haber);
  const totalPatrimonio = porTipo.PATRIMONIO.haber - porTipo.PATRIMONIO.debe + resultadoAcumulado;
  const balanceCuadrado =
    asientoDetalles.length === 0 ||
    Math.round(totalActivo * 100) === Math.round((totalPasivo + totalPatrimonio) * 100);

  // Cuentas por cobrar por antigüedad.
  const MS_DIA = 1000 * 60 * 60 * 24;
  const tramosCobrar = { alDia: 0, dias15: 0, dias30: 0, mas30: 0 };
  for (const f of facturasPendientes) {
    const dias = Math.floor((hoy.getTime() - f.fechaVencimiento.getTime()) / MS_DIA);
    const saldo = f.saldo.toNumber();
    if (dias <= 0) tramosCobrar.alDia += saldo;
    else if (dias <= 15) tramosCobrar.dias15 += saldo;
    else if (dias <= 30) tramosCobrar.dias30 += saldo;
    else tramosCobrar.mas30 += saldo;
  }
  const maxTramo = Math.max(
    tramosCobrar.alDia,
    tramosCobrar.dias15,
    tramosCobrar.dias30,
    tramosCobrar.mas30,
    1
  );

  // ---------------------------------------------------------------------
  // Comercial: embudo pedido → facturado → cobrado, y ticket promedio.
  // ---------------------------------------------------------------------
  const pedidosFacturadosMes = pedidosMes.filter((p) => p.estado === "FACTURADO").length;
  const facturasCobradasMes = facturasMes.filter((f) => f.estado === "PAGADA").length;
  const ticketPromedio = facturasMes.length > 0 ? ventasMes / facturasMes.length : 0;
  const facturasMesAnteriorCount = facturasRango.filter(
    (f) => f.fechaEmision >= baldesMes[baldesMes.length - 2]?.inicio && f.fechaEmision < inicioMes
  ).length;
  const ticketPromedioAnterior =
    facturasMesAnteriorCount > 0 ? ventasMesAnterior / facturasMesAnteriorCount : 0;
  const deltaTicket =
    ticketPromedioAnterior > 0 ? ((ticketPromedio - ticketPromedioAnterior) / ticketPromedioAnterior) * 100 : null;
  const maxEmbudo = Math.max(pedidosMes.length, 1);

  // ---------------------------------------------------------------------
  // Producción: cumplimiento y merma de los lotes finalizados este mes.
  // ---------------------------------------------------------------------
  const cumplimientoPromedio =
    lotesFinalizadosMes.length > 0
      ? (lotesFinalizadosMes.reduce(
          (acc, l) => acc + l.kgProducidos.toNumber() / l.kgObjetivo.toNumber(),
          0
        ) /
          lotesFinalizadosMes.length) *
        100
      : null;
  const mermaPromedio =
    lotesFinalizadosMes.length > 0
      ? (lotesFinalizadosMes.reduce(
          (acc, l) => acc + l.mermaKg.toNumber() / l.kgObjetivo.toNumber(),
          0
        ) /
          lotesFinalizadosMes.length) *
        100
      : null;
  const unidadesEnvasadasMes = envasadosMes.reduce((acc, e) => acc + e.unidades, 0);
  const maxKgObjetivoLote = Math.max(...lotesFinalizadosMes.map((l) => l.kgObjetivo.toNumber()), 1);

  // ---------------------------------------------------------------------
  // Inventario: rotación aproximada y top ítems por valor en stock.
  // ---------------------------------------------------------------------
  const rotacionInventario = valorInventario > 0 ? costoMes / valorInventario : null;
  const itemsValor = [
    ...presentaciones.map((p) => ({
      nombre: `${p.producto.nombre} — ${p.nombre}`,
      tipo: "Producto terminado",
      stock: `${formatNumero(p.stock, 0)} un.`,
      valor: p.stock.toNumber() * p.costoPromedio.toNumber(),
      bajoMinimo: p.stock.toNumber() < p.stockMinimo.toNumber(),
      sinStock: p.stock.toNumber() <= 0,
    })),
    ...insumos.map((i) => ({
      nombre: i.nombre,
      tipo: "Materia prima / insumo",
      stock: `${formatNumero(i.stock, 0)} ${i.unidadMedida}`,
      valor: i.stock.toNumber() * i.costoUnitario.toNumber(),
      bajoMinimo: i.stock.toNumber() < i.stockMinimo.toNumber(),
      sinStock: i.stock.toNumber() <= 0,
    })),
  ]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  // Semáforo por módulo (resumen ejecutivo).
  const semaforo = [
    {
      modulo: "Comercial",
      indicador:
        deltaVentas !== null
          ? `Ventas ${deltaVentas >= 0 ? "+" : ""}${deltaVentas.toFixed(1)}% vs. mes anterior`
          : `${facturasMes.length} facturas este mes`,
      estado: deltaVentas === null || deltaVentas >= 0 ? "bien" : "atencion",
    },
    {
      modulo: "Producción",
      indicador:
        cumplimientoPromedio !== null
          ? `Cumplimiento ${cumplimientoPromedio.toFixed(0)}% del objetivo`
          : "Sin lotes finalizados este mes",
      estado: cumplimientoPromedio === null || cumplimientoPromedio >= 95 ? "bien" : "atencion",
    },
    {
      modulo: "Finanzas",
      indicador:
        facturasVencidas.length > 0
          ? `${facturasVencidas.length} factura${facturasVencidas.length === 1 ? "" : "s"} vencida${facturasVencidas.length === 1 ? "" : "s"} (${formatMoneda(tramosCobrar.mas30 + tramosCobrar.dias30 + tramosCobrar.dias15)})`
          : "Sin facturas vencidas",
      estado: facturasVencidas.length === 0 ? "bien" : "atencion",
    },
    {
      modulo: "Inventario",
      indicador: `${presentacionesBajoMinimo.length + insumosBajoMinimo.length} ítem(s) bajo stock mínimo`,
      estado:
        presentacionesBajoMinimo.length + insumosBajoMinimo.length === 0
          ? "bien"
          : itemsValor.some((i) => i.sinStock)
            ? "critico"
            : "atencion",
    },
  ] as const;

  const PILL: Record<string, string> = {
    bien: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
    atencion: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
    critico: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  };
  const ETIQUETA_ESTADO_SEMAFORO: Record<string, string> = { bien: "Bien", atencion: "Atención", critico: "Crítico" };

  // =====================================================================
  // Contenido de cada pestaña
  // =====================================================================

  const contenidoResumen = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi etiqueta="Ventas del mes" valor={formatMoneda(ventasMes)} detalle={`${facturasMes.length} factura${facturasMes.length === 1 ? "" : "s"}`} href="/comercial/facturas" deltaPct={deltaVentas} />
        <Kpi etiqueta="Margen bruto del mes" valor={margenMes !== null ? `${margenMes.toFixed(1)}%` : "—"} detalle="ventas − costo de ventas" href="/finanzas/resultados" deltaPct={deltaMargen} deltaEnPuntos />
        <Kpi etiqueta="Cuentas por cobrar" valor={formatMoneda(cuentasPorCobrar)} detalle={facturasVencidas.length > 0 ? `${facturasVencidas.length} vencida${facturasVencidas.length === 1 ? "" : "s"}` : "sin facturas vencidas"} alerta={facturasVencidas.length > 0} href="/finanzas/cuentas-por-cobrar" />
        <Kpi etiqueta="Comisiones por pagar" valor={formatMoneda(comisionesPendientes)} detalle="neto de reversiones" href="/comercial/comisiones" />
        <Kpi etiqueta="Pedidos pendientes" valor={String(pedidosPendientes)} detalle="por facturar" href="/comercial/pedidos" />
        <Kpi etiqueta="Valor de inventario" valor={formatMoneda(valorInventario)} detalle="producto terminado + insumos, a costo" href="/finanzas/costos" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Semáforo por módulo</h2>
          <table className="tabla mt-3">
            <thead>
              <tr><th>Módulo</th><th>Indicador clave</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {semaforo.map((s) => (
                <tr key={s.modulo}>
                  <td className="font-medium">{s.modulo}</td>
                  <td className="text-sm text-neutral-500">{s.indicador}</td>
                  <td><span className={`insignia ${PILL[s.estado]}`}>{ETIQUETA_ESTADO_SEMAFORO[s.estado]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Tendencia de ventas ({MESES_TENDENCIA} meses)</h2>
          <div className="mt-4">
            <GraficoLinea datos={ventasPorMes} formatoValor={(v) => formatMoneda(v)} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingSeccion titulo="Top clientes del mes" href="/comercial/clientes" datos={topClientes} max={maxCliente} vacio="Sin ventas este mes todavía." />
        <RankingSeccion titulo="Top vendedores del mes" href="/comercial/vendedores" datos={topVendedores} max={maxVendedor} vacio="Sin ventas este mes todavía." />
      </div>
    </div>
  );

  const contenidoComercial = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi etiqueta="Pedidos del mes" valor={String(pedidosMes.length)} detalle={`${pedidosFacturadosMes} facturados, ${pedidosMes.length - pedidosFacturadosMes} sin facturar`} href="/comercial/pedidos" />
        <Kpi etiqueta="Ticket promedio" valor={formatMoneda(ticketPromedio)} detalle="valor de venta por factura" href="/comercial/facturas" deltaPct={deltaTicket} />
        <Kpi etiqueta="Clientes activos" valor={String(clientesActivosCount)} detalle="en cartera" href="/comercial/clientes" />
        <Kpi
          etiqueta="Cotizaciones por vencer"
          valor={String(cotizacionesPorVencer.length)}
          detalle="pendientes, vencen en 7 días o menos"
          alerta={cotizacionesPorVencer.length > 0}
          href="/comercial/cotizaciones"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Embudo del mes: pedido → facturado → cobrado</h2>
          <div className="flex items-end gap-3 mt-6" style={{ height: 110 }}>
            <BarraEmbudo etiqueta="Pedidos" valor={pedidosMes.length} max={maxEmbudo} />
            <BarraEmbudo etiqueta="Facturados" valor={pedidosFacturadosMes} max={maxEmbudo} />
            <BarraEmbudo etiqueta="Cobrados" valor={facturasCobradasMes} max={maxEmbudo} />
          </div>
        </section>
        <RankingSeccion titulo="Top vendedores del mes" href="/comercial/vendedores" datos={topVendedores} max={maxVendedor} vacio="Sin ventas este mes todavía." />
      </div>
      <RankingSeccion titulo="Top clientes del mes" href="/comercial/clientes" datos={topClientes} max={maxCliente} vacio="Sin ventas este mes todavía." ancho />
      {cotizacionesPorVencer.length > 0 && (
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Cotizaciones por vencer</h2>
            <Link href="/comercial/cotizaciones" className="text-xs text-neutral-500 hover:underline">Ver todas</Link>
          </div>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {cotizacionesPorVencer.map((c) => (
              <li key={c.id} className="py-2 text-sm flex justify-between">
                <span>
                  <Link href={`/comercial/cotizaciones/${c.id}`} className="font-mono text-xs hover:underline">{c.numero}</Link>{" "}
                  {c.cliente.razonSocial}
                </span>
                <span
                  className={`font-medium ${c.validaHasta < hoy ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}
                >
                  {c.validaHasta < hoy ? "vencida" : "vence"}{" "}
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(c.validaHasta)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const contenidoProduccion = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi etiqueta="Lotes en curso" valor={String(lotesActivos.length)} detalle={`${lotesActivos.filter((l) => l.estado === "PENDIENTE_CALIDAD").length} en calidad`} href="/produccion/lotes" />
        <Kpi etiqueta="Cumplimiento" valor={cumplimientoPromedio !== null ? `${cumplimientoPromedio.toFixed(0)}%` : "—"} detalle="kg producidos / objetivo" href="/produccion/lotes" />
        <Kpi etiqueta="Merma promedio" valor={mermaPromedio !== null ? `${mermaPromedio.toFixed(1)}%` : "—"} detalle="de lotes finalizados este mes" href="/produccion/lotes" />
        <Kpi etiqueta="Envasados del mes" valor={String(envasadosMes.length)} detalle={`${formatNumero(unidadesEnvasadasMes, 0)} unidades`} href="/produccion/envasados" />
        <Kpi
          etiqueta="Mantenimiento pendiente"
          valor={String(ordenesMantenimientoPendientes.length)}
          detalle={`${mantenimientoVencido.length} vencida(s)`}
          alerta={mantenimientoVencido.length > 0}
          href="/produccion/mantenimiento"
        />
      </div>
      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Cumplimiento por lote (kg producidos vs. objetivo)</h2>
          <Link href="/produccion/lotes" className="text-xs text-neutral-500 hover:underline">Ver todos</Link>
        </div>
        {lotesFinalizadosMes.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-3">Sin lotes finalizados este mes.</p>
        ) : (
          <div className="flex flex-col gap-2.5 mt-4">
            {lotesFinalizadosMes.map((l) => (
              <BarraRanking
                key={l.id}
                etiqueta={l.codigo}
                valor={l.kgProducidos.toNumber()}
                max={maxKgObjetivoLote}
                formatoValor={() => `${formatNumero(l.kgProducidos, 0)} / ${formatNumero(l.kgObjetivo, 0)} kg`}
              />
            ))}
          </div>
        )}
      </section>
      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Órdenes de producción en curso</h2>
          <Link href="/produccion/lotes" className="text-xs text-neutral-500 hover:underline">Ver todos</Link>
        </div>
        {lotesActivos.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-3">No hay órdenes de producción en proceso.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {lotesActivos.map((l) => (
              <li key={l.id} className="py-2 text-sm flex justify-between items-center">
                <span>
                  <Link href={`/produccion/lotes/${l.id}`} className="font-mono text-xs hover:underline">{l.codigo}</Link>{" "}
                  {l.formula.producto.nombre} · {formatNumero(l.kgObjetivo, 0)} kg
                </span>
                <span className={`insignia ${l.estado === "EN_PROCESO" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"}`}>
                  {ETIQUETA_ESTADO_LOTE[l.estado]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Mantenimiento pendiente</h2>
          <Link href="/produccion/mantenimiento" className="text-xs text-neutral-500 hover:underline">Ver todos</Link>
        </div>
        {ordenesMantenimientoPendientes.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-3">Sin alertas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {ordenesMantenimientoPendientes.map((o) => {
              const vencida = o.fechaProgramada < hoy;
              return (
                <li key={o.id} className="py-2 text-sm flex justify-between items-center">
                  <span>
                    <Link href={`/produccion/mantenimiento/${o.id}`} className="font-mono text-xs hover:underline">{o.codigo}</Link>{" "}
                    {o.equipo.nombre} · {o.tipo === "PREVENTIVO" ? "Preventivo" : "Correctivo"} · {formatFecha(o.fechaProgramada)}
                  </span>
                  <span className={`insignia ${vencida ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"}`}>
                    {vencida ? "Vencida" : "Programada"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );

  const contenidoFinanzas = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi etiqueta="Ventas netas" valor={formatMoneda(ventasNetas)} detalle="este mes" href="/finanzas/resultados" />
        <Kpi etiqueta="Utilidad operativa" valor={formatMoneda(utilidadOperativa)} detalle={ventasNetas > 0 ? `${((utilidadOperativa / ventasNetas) * 100).toFixed(0)}% de las ventas` : "—"} href="/finanzas/resultados" />
        <Kpi etiqueta="Cuentas por pagar" valor={formatMoneda(totalCuentasPorPagar)} detalle={`${cuentasPorPagarPendientes.length} pendiente${cuentasPorPagarPendientes.length === 1 ? "" : "s"}`} href="/finanzas/cuentas-por-pagar" />
        <Kpi etiqueta="Balance" valor={balanceCuadrado ? "Cuadrado ✓" : "Descuadrado ✗"} detalle="activo = pasivo + patrimonio" alerta={!balanceCuadrado} href="/finanzas/situacion-financiera" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Estado de resultados del mes</h2>
          <table className="tabla mt-3">
            <tbody>
              <FilaResultado etiqueta="Ventas netas" valor={ventasNetas} />
              <FilaResultado etiqueta="(−) Costo de ventas" valor={-costoMes} />
              <FilaResultado etiqueta="Utilidad bruta" valor={utilidadBruta} destacada />
              <FilaResultado etiqueta="(−) Comisiones (neto)" valor={-comisionesNetas} />
              <FilaResultado etiqueta="(−) Gastos operativos" valor={-gastosOperativos} />
              <FilaResultado etiqueta="(+) Otros ingresos" valor={otrosIngresos} />
              <FilaResultado etiqueta="Utilidad operativa" valor={utilidadOperativa} destacada />
            </tbody>
          </table>
        </section>
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Cuentas por cobrar — antigüedad</h2>
          <div className="flex flex-col gap-2.5 mt-4">
            <BarraRanking etiqueta="Al día" valor={tramosCobrar.alDia} max={maxTramo} formatoValor={(v) => formatMoneda(v)} />
            <BarraRanking etiqueta="1–15 días" valor={tramosCobrar.dias15} max={maxTramo} formatoValor={(v) => formatMoneda(v)} />
            <BarraRanking etiqueta="16–30 días" valor={tramosCobrar.dias30} max={maxTramo} formatoValor={(v) => formatMoneda(v)} />
            <BarraRanking etiqueta="+30 días" valor={tramosCobrar.mas30} max={maxTramo} formatoValor={(v) => formatMoneda(v)} />
          </div>
        </section>
      </div>
    </div>
  );

  const contenidoInventario = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi etiqueta="Valor total" valor={formatMoneda(valorInventario)} detalle="producto terminado + insumos" href="/finanzas/costos" />
        <Kpi etiqueta="Rotación (mensual)" valor={rotacionInventario !== null ? `${rotacionInventario.toFixed(1)}x` : "—"} detalle="costo de ventas / inventario" href="/finanzas/costos" />
        <Kpi etiqueta="Ítems bajo mínimo" valor={String(presentacionesBajoMinimo.length + insumosBajoMinimo.length)} detalle={`${presentacionesBajoMinimo.length} presentación(es), ${insumosBajoMinimo.length} insumo(s)`} alerta={presentacionesBajoMinimo.length + insumosBajoMinimo.length > 0} href="/catalogo/presentaciones" />
        <Kpi etiqueta="SKUs activos" valor={String(presentaciones.length)} detalle="presentaciones" href="/catalogo/presentaciones" />
        <Kpi
          etiqueta="Depósito comprometido en cascos"
          valor={formatMoneda(totalDepositoCascos)}
          detalle="envases retornables sin devolver"
          href="/comercial/cascos"
        />
        <Kpi
          etiqueta="Conteos con diferencia grande"
          valor={String(diferenciasGrandes.length)}
          detalle="últimos 2 meses, ≥10% del saldo"
          alerta={diferenciasGrandes.length > 0}
          href="/inventario/conteos"
        />
      </div>
      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Top 5 ítems por valor en stock</h2>
        <table className="tabla mt-3">
          <thead>
            <tr><th>Ítem</th><th>Tipo</th><th>Stock</th><th className="text-right">Valor</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {itemsValor.map((i) => (
              <tr key={i.nombre}>
                <td>{i.nombre}</td>
                <td className="text-sm text-neutral-500">{i.tipo}</td>
                <td>{i.stock}</td>
                <td className="text-right">{formatMoneda(i.valor)}</td>
                <td>
                  <span className={`insignia ${i.sinStock ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" : i.bajoMinimo ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"}`}>
                    {i.sinStock ? "Sin stock" : i.bajoMinimo ? "Bajo" : "OK"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Presentaciones bajo stock mínimo</h2>
            <Link href="/catalogo/presentaciones" className="text-xs text-neutral-500 hover:underline">Ver catálogo</Link>
          </div>
          {presentacionesBajoMinimo.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">Sin alertas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {presentacionesBajoMinimo.map((p) => (
                <li key={p.id} className="py-2 text-sm flex justify-between">
                  <span>{p.producto.nombre} — {p.nombre}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{formatNumero(p.stock, 0)} / mín. {formatNumero(p.stockMinimo, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Insumos bajo stock mínimo</h2>
            <Link href="/catalogo/insumos" className="text-xs text-neutral-500 hover:underline">Ver insumos</Link>
          </div>
          {insumosBajoMinimo.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">Sin alertas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {insumosBajoMinimo.map((i) => (
                <li key={i.id} className="py-2 text-sm flex justify-between">
                  <span>{i.nombre}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{formatNumero(i.stock, 0)} / mín. {formatNumero(i.stockMinimo, 0)} {i.unidadMedida}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {envasadosPorVencer.length > 0 && (
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Lotes próximos a vencer o vencidos (próximos 60 días)
            </h2>
            <Link href="/produccion/envasados" className="text-xs text-neutral-500 hover:underline">Ver envasados</Link>
          </div>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {envasadosPorVencer.map((e) => {
              const vencido = e.fechaVencimiento! < hoy;
              return (
                <li key={e.id} className="py-2 text-sm flex justify-between">
                  <span>
                    {e.codigo} — {e.presentacion.producto.nombre} {e.presentacion.nombre}
                  </span>
                  <span className={`font-medium ${vencido ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {e.unidadesDisponibles} un. sin vender · vence{" "}
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(e.fechaVencimiento!)}
                    {vencido && " (VENCIDO)"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="border border-black/10 dark:border-white/10 rounded-lg p-4 no-imprimir">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Facturas por vencer / vencidas</h2>
          <Link href="/comercial/facturas" className="text-xs text-neutral-500 hover:underline">Ver todas</Link>
        </div>
        {facturasPendientes.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-3">No hay facturas pendientes de cobro.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {facturasPendientes.slice(0, 6).map((f) => {
              const vencida = f.fechaVencimiento < hoy;
              return (
                <li key={f.id} className="py-2 text-sm flex justify-between items-center">
                  <span><Link href={`/comercial/facturas/${f.id}`} className="font-mono text-xs hover:underline">{f.numero}</Link> {f.cliente.razonSocial}</span>
                  <span className={vencida ? "text-red-600 dark:text-red-400 font-medium" : "text-neutral-500"}>
                    {formatMoneda(f.saldo)} · {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(f.fechaVencimiento)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {diferenciasGrandes.length > 0 && (
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Conteos con diferencia grande (posible merma)
            </h2>
            <Link href="/inventario/conteos" className="text-xs text-neutral-500 hover:underline">Ver conteos</Link>
          </div>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {diferenciasGrandes.map((d, i) => (
              <li key={i} className="py-2 text-sm flex justify-between">
                <span>
                  <span className="font-mono text-xs">{d.conteoCodigo}</span> — {d.nombreItem}
                </span>
                <span className={`font-medium ${d.diferencia < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                  {d.diferencia > 0 ? "+" : ""}
                  {formatNumero(d.diferencia, 2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Panel general</h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "full" }).format(hoy)}
      </p>

      <div className="mt-6">
        <FichaTabs
          pestanas={[
            { id: "resumen", etiqueta: "Resumen ejecutivo", contenido: contenidoResumen },
            { id: "comercial", etiqueta: "Comercial", contenido: contenidoComercial },
            { id: "produccion", etiqueta: "Producción", contenido: contenidoProduccion },
            { id: "finanzas", etiqueta: "Finanzas", contenido: contenidoFinanzas },
            { id: "inventario", etiqueta: "Inventario", contenido: contenidoInventario },
          ]}
        />
      </div>
    </div>
  );
}

function RankingSeccion({
  titulo,
  href,
  datos,
  max,
  vacio,
  ancho = false,
}: {
  titulo: string;
  href: string;
  datos: { nombre: string; total: number }[];
  max: number;
  vacio: string;
  ancho?: boolean;
}) {
  return (
    <section className={`border border-black/10 dark:border-white/10 rounded-lg p-4 ${ancho ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">{titulo}</h2>
        <Link href={href} className="text-xs text-neutral-500 hover:underline">Ver todos</Link>
      </div>
      {datos.length === 0 ? (
        <p className="text-sm text-neutral-500 mt-3">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-2.5 mt-4">
          {datos.map((d) => (
            <BarraRanking key={d.nombre} etiqueta={d.nombre} valor={d.total} max={max} formatoValor={(v) => formatMoneda(v)} />
          ))}
        </div>
      )}
    </section>
  );
}

function BarraEmbudo({ etiqueta, valor, max }: { etiqueta: string; valor: number; max: number }) {
  const alturaPct = max > 0 ? Math.max((valor / max) * 100, valor > 0 ? 8 : 2) : 2;
  return (
    <div className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{valor}</span>
      <div className="w-full rounded-t-lg" style={{ height: `${alturaPct}%`, background: "var(--epicor-azul)" }} />
      <span className="text-xs text-neutral-500 text-center">{etiqueta}</span>
    </div>
  );
}

function FilaResultado({
  etiqueta,
  valor,
  destacada = false,
}: {
  etiqueta: string;
  valor: number;
  destacada?: boolean;
}) {
  return (
    <tr className={destacada ? "bg-amber-500/10" : ""}>
      <td className={destacada ? "font-semibold" : "text-neutral-600 dark:text-neutral-400"}>{etiqueta}</td>
      <td className={`text-right ${destacada ? "font-semibold" : ""} ${valor < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
        {formatMoneda(valor)}
      </td>
    </tr>
  );
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  href,
  alerta = false,
  deltaPct,
  deltaEnPuntos = false,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  href: string;
  alerta?: boolean;
  deltaPct?: number | null;
  deltaEnPuntos?: boolean;
}) {
  const sube = typeof deltaPct === "number" && deltaPct >= 0;
  return (
    <Link
      href={href}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:border-black/30 dark:hover:border-white/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">{etiqueta}</p>
        {typeof deltaPct === "number" && (
          <span
            className={`text-xs font-medium shrink-0 ${
              sube ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {sube ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}
            {deltaEnPuntos ? " pts" : "%"}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold mt-1 text-neutral-900 dark:text-neutral-100">{valor}</p>
      <p className={`text-xs mt-0.5 ${alerta ? "text-red-600 dark:text-red-400" : "text-neutral-400"}`}>
        {detalle}{typeof deltaPct === "number" ? " · vs. mes anterior" : ""}
      </p>
    </Link>
  );
}
