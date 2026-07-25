import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import GraficoLinea from "@/components/GraficoLinea";
import BarraRanking from "@/components/BarraRanking";

const MESES_TENDENCIA = 6;

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
    lotesActivos,
    presentaciones,
    insumos,
    pedidosPendientes,
  ] = await Promise.all([
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" }, fechaEmision: { gte: inicioRango } },
      include: { cliente: true },
    }),
    prisma.factura.findMany({
      where: { estado: "PENDIENTE" },
      include: { cliente: true },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.comision.findMany({ where: { estado: "PENDIENTE" } }),
    prisma.loteGranel.findMany({
      where: { estado: { in: ["EN_PROCESO", "PENDIENTE_CALIDAD"] } },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "asc" },
    }),
    prisma.presentacion.findMany({ where: { activo: true }, include: { producto: true } }),
    prisma.insumo.findMany({ where: { activo: true } }),
    prisma.pedido.count({ where: { estado: "PENDIENTE" } }),
  ]);

  // Tendencia de ventas: un balde por mes (los últimos MESES_TENDENCIA, el
  // actual incluido) con la suma de ventas netas de IGV de ese mes.
  const baldesMes = Array.from({ length: MESES_TENDENCIA }, (_, i) => {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (MESES_TENDENCIA - 1 - i), 1);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    return { inicio, fin, total: 0 };
  });
  for (const f of facturasRango) {
    const balde = baldesMes.find((b) => f.fechaEmision >= b.inicio && f.fechaEmision < b.fin);
    if (balde) balde.total += baseFactura(f);
  }
  const ventasPorMes = baldesMes.map((b) => ({
    etiqueta: new Intl.DateTimeFormat("es-PE", { month: "short" }).format(b.inicio).replace(".", ""),
    valor: b.total,
  }));

  const facturasMes = facturasRango.filter((f) => f.fechaEmision >= inicioMes);
  // Ventas sin IGV (facturas antiguas sin desglose usan su total)
  const ventasMes = baldesMes[baldesMes.length - 1].total;
  const ventasMesAnterior = baldesMes.length > 1 ? baldesMes[baldesMes.length - 2].total : 0;
  const deltaVentas =
    ventasMesAnterior > 0 ? ((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100 : null;

  // Top 5 clientes del mes por ventas.
  const ventasPorCliente = new Map<string, { nombre: string; total: number }>();
  for (const f of facturasMes) {
    const fila = ventasPorCliente.get(f.clienteId) ?? { nombre: f.cliente.razonSocial, total: 0 };
    fila.total += baseFactura(f);
    ventasPorCliente.set(f.clienteId, fila);
  }
  const topClientes = [...ventasPorCliente.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxCliente = Math.max(...topClientes.map((c) => c.total), 1);

  const cuentasPorCobrar = facturasPendientes.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const facturasVencidas = facturasPendientes.filter(
    (f) => f.fechaVencimiento < hoy && f.saldo.toNumber() > 0
  );
  const comisionesPendientes = comisiones.reduce((acc, c) => acc + c.monto.toNumber(), 0);

  const presentacionesBajoMinimo = presentaciones.filter(
    (p) => p.stock.toNumber() < p.stockMinimo.toNumber()
  );
  const insumosBajoMinimo = insumos.filter((i) => i.stock.toNumber() < i.stockMinimo.toNumber());

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Panel general
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "full" }).format(hoy)}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Kpi
          etiqueta="Ventas del mes"
          valor={formatMoneda(ventasMes)}
          detalle={`${facturasMes.length} factura${facturasMes.length === 1 ? "" : "s"}`}
          href="/comercial/facturas"
          deltaPct={deltaVentas}
        />
        <Kpi
          etiqueta="Cuentas por cobrar"
          valor={formatMoneda(cuentasPorCobrar)}
          detalle={
            facturasVencidas.length > 0
              ? `${facturasVencidas.length} vencida${facturasVencidas.length === 1 ? "" : "s"}`
              : "sin facturas vencidas"
          }
          alerta={facturasVencidas.length > 0}
          href="/comercial/facturas"
        />
        <Kpi
          etiqueta="Comisiones por pagar"
          valor={formatMoneda(comisionesPendientes)}
          detalle="neto de reversiones"
          href="/comercial/comisiones"
        />
        <Kpi
          etiqueta="Pedidos pendientes"
          valor={String(pedidosPendientes)}
          detalle="por facturar"
          href="/comercial/pedidos"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <section className="lg:col-span-2 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Tendencia de ventas ({MESES_TENDENCIA} meses)
          </h2>
          <div className="mt-4">
            <GraficoLinea datos={ventasPorMes} formatoValor={(v) => formatMoneda(v)} />
          </div>
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Top clientes del mes</h2>
            <Link href="/comercial/clientes" className="text-xs text-neutral-500 hover:underline">
              Ver todos
            </Link>
          </div>
          {topClientes.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">Sin ventas este mes todavía.</p>
          ) : (
            <div className="flex flex-col gap-2.5 mt-4">
              {topClientes.map((c) => (
                <BarraRanking
                  key={c.nombre}
                  etiqueta={c.nombre}
                  valor={c.total}
                  max={maxCliente}
                  formatoValor={(v) => formatMoneda(v)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Órdenes de producción en curso
            </h2>
            <Link href="/produccion/lotes" className="text-xs text-neutral-500 hover:underline">
              Ver todos
            </Link>
          </div>
          {lotesActivos.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">No hay órdenes de producción en proceso.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {lotesActivos.map((l) => (
                <li key={l.id} className="py-2 text-sm flex justify-between items-center">
                  <span>
                    <Link href={`/produccion/lotes/${l.id}`} className="font-mono text-xs hover:underline">
                      {l.codigo}
                    </Link>{" "}
                    {l.formula.producto.nombre} · {formatNumero(l.kgObjetivo, 0)} kg
                  </span>
                  <span
                    className={`insignia ${
                      l.estado === "EN_PROCESO"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {ETIQUETA_ESTADO_LOTE[l.estado]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Facturas por vencer / vencidas
            </h2>
            <Link href="/comercial/facturas" className="text-xs text-neutral-500 hover:underline">
              Ver todas
            </Link>
          </div>
          {facturasPendientes.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">No hay facturas pendientes de cobro.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {facturasPendientes.slice(0, 6).map((f) => {
                const vencida = f.fechaVencimiento < hoy;
                return (
                  <li key={f.id} className="py-2 text-sm flex justify-between items-center">
                    <span>
                      <Link href={`/comercial/facturas/${f.id}`} className="font-mono text-xs hover:underline">
                        {f.numero}
                      </Link>{" "}
                      {f.cliente.razonSocial}
                    </span>
                    <span className={vencida ? "text-red-600 dark:text-red-400 font-medium" : "text-neutral-500"}>
                      {formatMoneda(f.saldo)} ·{" "}
                      {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(f.fechaVencimiento)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Presentaciones bajo stock mínimo
            </h2>
            <Link href="/catalogo/presentaciones" className="text-xs text-neutral-500 hover:underline">
              Ver catálogo
            </Link>
          </div>
          {presentacionesBajoMinimo.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">Sin alertas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {presentacionesBajoMinimo.map((p) => (
                <li key={p.id} className="py-2 text-sm flex justify-between">
                  <span>
                    {p.producto.nombre} — {p.nombre}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {formatNumero(p.stock, 0)} / mín. {formatNumero(p.stockMinimo, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Insumos bajo stock mínimo
            </h2>
            <Link href="/catalogo/insumos" className="text-xs text-neutral-500 hover:underline">
              Ver insumos
            </Link>
          </div>
          {insumosBajoMinimo.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-3">Sin alertas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
              {insumosBajoMinimo.map((i) => (
                <li key={i.id} className="py-2 text-sm flex justify-between">
                  <span>{i.nombre}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {formatNumero(i.stock, 0)} / mín. {formatNumero(i.stockMinimo, 0)} {i.unidadMedida}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  href,
  alerta = false,
  deltaPct,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  href: string;
  alerta?: boolean;
  deltaPct?: number | null;
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
            {sube ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
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
