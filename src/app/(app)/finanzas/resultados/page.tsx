import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

// Estado de resultados operativo del mes:
//   Ventas netas (facturas − notas de crédito)
// − Costo de ventas (costo congelado al facturar)
// = Utilidad bruta
// − Comisiones netas del mes
// − Gastos operativos (egresos manuales de caja)
// + Otros ingresos (ingresos manuales de caja)
// = Utilidad operativa
export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;

  const hoy = new Date();
  let anio = hoy.getFullYear();
  let mesIdx = hoy.getMonth(); // 0-11
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [a, m] = mes.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      anio = a;
      mesIdx = m - 1;
    }
  }
  const inicio = new Date(anio, mesIdx, 1);
  const fin = new Date(anio, mesIdx + 1, 1);

  const mesAnterior = new Date(anio, mesIdx - 1, 1);
  const mesSiguiente = new Date(anio, mesIdx + 1, 1);
  const aParam = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const [facturas, notasCredito, comisiones, movimientosManuales, controlesGL] = await Promise.all([
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" }, fechaEmision: { gte: inicio, lt: fin } },
      include: { pedido: { include: { detalles: true } }, cliente: true },
      orderBy: { fechaEmision: "asc" },
    }),
    prisma.notaCredito.findMany({
      where: { fecha: { gte: inicio, lt: fin }, factura: { estado: { not: "ANULADA" } } },
      include: { factura: true },
    }),
    prisma.comision.findMany({ where: { creadoEn: { gte: inicio, lt: fin } } }),
    // Solo movimientos manuales: los automáticos llevan referencia (factura/documento)
    prisma.movimientoCaja.findMany({
      where: { fecha: { gte: inicio, lt: fin }, referencia: null },
    }),
    prisma.controlContable.findMany({ where: { clave: { in: ["VENTAS", "COSTO_VENTAS"] } } }),
  ]);

  // Todo el estado se calcula sobre la base imponible (sin IGV): el impuesto
  // no es ingreso. Facturas antiguas sin desglose usan su total como base.
  const baseFactura = (f: { subtotal: { toNumber(): number }; total: { toNumber(): number } }) =>
    f.subtotal.toNumber() > 0 ? f.subtotal.toNumber() : f.total.toNumber();

  const ventasBrutas = facturas.reduce((acc, f) => acc + baseFactura(f), 0);
  const totalNC = notasCredito.reduce(
    (acc, nc) => acc + nc.monto.toNumber() / (1 + nc.factura.tasaIgv.toNumber() / 100),
    0
  );
  const ventasNetas = ventasBrutas - totalNC;

  const costoVentas = facturas.reduce(
    (acc, f) =>
      acc +
      f.pedido.detalles.reduce((s, d) => s + d.cantidad * d.costoUnitario.toNumber(), 0),
    0
  );
  const sinCosto = facturas.some((f) =>
    f.pedido.detalles.some((d) => d.costoUnitario.toNumber() === 0)
  );

  const utilidadBruta = ventasNetas - costoVentas;
  const comisionesNetas = comisiones.reduce((acc, c) => acc + c.monto.toNumber(), 0);
  const gastosOperativos = movimientosManuales
    .filter((m) => m.tipo === "EGRESO")
    .reduce((acc, m) => acc + m.monto.toNumber(), 0);
  const otrosIngresos = movimientosManuales
    .filter((m) => m.tipo === "INGRESO")
    .reduce((acc, m) => acc + m.monto.toNumber(), 0);

  const utilidadOperativa = utilidadBruta - comisionesNetas - gastosOperativos + otrosIngresos;

  // Verificación cruzada contra el libro mayor: si los controles VENTAS/
  // COSTO_VENTAS están configurados, el asiento automático de cada factura
  // debió postear el mismo monto. Una diferencia indica ventas del mes sin
  // asiento (período cerrado al facturar, o control agregado después).
  const cuentaVentasId = controlesGL.find((c) => c.clave === "VENTAS")?.cuentaId;
  const cuentaCostoId = controlesGL.find((c) => c.clave === "COSTO_VENTAS")?.cuentaId;
  let diferenciaGL: number | null = null;
  if (cuentaVentasId) {
    const detallesGL = await prisma.asientoDetalle.findMany({
      where: {
        cuentaId: { in: [cuentaVentasId, cuentaCostoId].filter((x): x is string => !!x) },
        asiento: { anio, mes: mesIdx + 1 },
      },
    });
    const ventasGL = detallesGL
      .filter((d) => d.cuentaId === cuentaVentasId)
      .reduce((acc, d) => acc + d.haber.toNumber() - d.debe.toNumber(), 0);
    diferenciaGL = Math.round((ventasGL - ventasBrutas) * 100) / 100;
  }

  const nombreMes = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    inicio
  );

  const pct = (v: number) => (ventasNetas > 0 ? `${((v / ventasNetas) * 100).toFixed(1)}%` : "—");

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between no-imprimir">
        <div className="flex items-center gap-2">
          <Link
            href={`/finanzas/resultados?mes=${aParam(mesAnterior)}`}
            className="boton-secundario px-2 py-1"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <Link
            href={`/finanzas/resultados?mes=${aParam(mesSiguiente)}`}
            className="boton-secundario px-2 py-1"
            aria-label="Mes siguiente"
          >
            →
          </Link>
        </div>
        <BotonImprimir />
      </div>

      <div className="documento">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
          Estado de resultados
        </h1>
        <p className="text-neutral-500 mt-1 capitalize">{nombreMes}</p>

        <table className="tabla mt-6">
          <tbody>
            <Fila etiqueta={`Ventas facturadas (${facturas.length})`} valor={ventasBrutas} />
            <Fila etiqueta={`(−) Notas de crédito (${notasCredito.length})`} valor={-totalNC} />
            <FilaTotal etiqueta="Ventas netas" valor={ventasNetas} pct={ventasNetas > 0 ? "100%" : "—"} />
            <Fila etiqueta="(−) Costo de ventas" valor={-costoVentas} />
            <FilaTotal etiqueta="Utilidad bruta" valor={utilidadBruta} pct={pct(utilidadBruta)} />
            <Fila etiqueta="(−) Comisiones de vendedores (neto)" valor={-comisionesNetas} />
            <Fila etiqueta="(−) Gastos operativos (caja)" valor={-gastosOperativos} />
            <Fila etiqueta="(+) Otros ingresos (caja)" valor={otrosIngresos} />
            <FilaTotal
              etiqueta="Utilidad operativa"
              valor={utilidadOperativa}
              pct={pct(utilidadOperativa)}
              destacada
            />
          </tbody>
        </table>

        {sinCosto && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-4">
            ⚠ Hay ventas del mes con costo S/ 0.00 (facturadas antes de que existiera el costeo o
            de producir con costos registrados). La utilidad bruta de este mes está sobreestimada.
          </p>
        )}
        {diferenciaGL !== null && Math.abs(diferenciaGL) > 0.05 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            ⚠ Las ventas de este mes (S/ {ventasBrutas.toFixed(2)}) no coinciden con lo posteado en
            el libro mayor (diferencia S/ {diferenciaGL.toFixed(2)}) — revise si hubo períodos
            cerrados o controles contables agregados después de facturar. Ver{" "}
            <Link href="/finanzas/situacion-financiera" className="underline">
              Situación financiera
            </Link>
            .
          </p>
        )}

        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Detalle de ventas del mes
          </h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th className="text-right">Venta</th>
                <th className="text-right">Costo</th>
                <th className="text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => {
                const venta = baseFactura(f);
                const costo = f.pedido.detalles.reduce(
                  (s, d) => s + d.cantidad * d.costoUnitario.toNumber(),
                  0
                );
                const margen = venta - costo;
                return (
                  <tr key={f.id}>
                    <td className="font-mono text-xs">
                      <Link href={`/comercial/facturas/${f.id}`} className="hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td>{f.cliente.razonSocial}</td>
                    <td className="text-right">{formatMoneda(venta)}</td>
                    <td className="text-right">{formatMoneda(costo)}</td>
                    <td
                      className={`text-right font-medium ${
                        margen >= 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatMoneda(margen)}
                    </td>
                  </tr>
                );
              })}
              {facturas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-4">
                    Sin ventas en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <tr>
      <td className="text-neutral-600 dark:text-neutral-400">{etiqueta}</td>
      <td className={`text-right ${valor < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
        {formatMoneda(valor)}
      </td>
      <td className="w-20"></td>
    </tr>
  );
}

function FilaTotal({
  etiqueta,
  valor,
  pct,
  destacada = false,
}: {
  etiqueta: string;
  valor: number;
  pct: string;
  destacada?: boolean;
}) {
  return (
    <tr className={destacada ? "bg-amber-500/10" : ""}>
      <td className="font-semibold text-neutral-900 dark:text-neutral-100">{etiqueta}</td>
      <td
        className={`text-right font-semibold ${
          valor < 0
            ? "text-red-600 dark:text-red-400"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {formatMoneda(valor)}
      </td>
      <td className="text-right text-xs text-neutral-500 w-20">{pct}</td>
    </tr>
  );
}
