import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

type Resultado = {
  ventasBrutas: number;
  totalNC: number;
  ventasNetas: number;
  costoVentas: number;
  utilidadBruta: number;
  comisionesNetas: number;
  gastosOperativos: number;
  otrosIngresos: number;
  utilidadOperativa: number;
  numFacturas: number;
  numNC: number;
  sinCosto: boolean;
  facturas: {
    id: string;
    numero: string;
    cliente: { razonSocial: string };
    venta: number;
    costo: number;
  }[];
};

const baseFactura = (f: {
  subtotalFuncional: { toNumber(): number };
  totalFuncional: { toNumber(): number };
}) =>
  f.subtotalFuncional.toNumber() > 0
    ? f.subtotalFuncional.toNumber()
    : f.totalFuncional.toNumber();

async function calcularResultados(inicio: Date, fin: Date): Promise<Resultado> {
  const [facturas, notasCredito, comisiones, movimientosManuales] = await Promise.all([
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" }, fechaEmision: { gte: inicio, lt: fin } },
      include: { detalles: true, cliente: true },
      orderBy: { fechaEmision: "asc" },
    }),
    prisma.notaCredito.findMany({
      where: { fecha: { gte: inicio, lt: fin }, factura: { estado: { not: "ANULADA" } } },
      include: { factura: true },
    }),
    prisma.comision.findMany({ where: { creadoEn: { gte: inicio, lt: fin } } }),
    prisma.movimientoCaja.findMany({
      where: { fecha: { gte: inicio, lt: fin }, referencia: null },
    }),
  ]);

  const ventasBrutas = facturas.reduce((acc, f) => acc + baseFactura(f), 0);
  const totalNC = notasCredito.reduce(
    (acc, nc) => acc + nc.montoFuncional.toNumber() / (1 + nc.factura.tasaIgv.toNumber() / 100),
    0
  );
  const ventasNetas = ventasBrutas - totalNC;

  const costoVentas = facturas.reduce(
    (acc, f) =>
      acc + f.detalles.reduce((s, d) => s + d.cantidad * d.costoUnitario.toNumber(), 0),
    0
  );
  const sinCosto = facturas.some((f) =>
    f.detalles.some((d) => d.costoUnitario.toNumber() === 0)
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

  return {
    ventasBrutas,
    totalNC,
    ventasNetas,
    costoVentas,
    utilidadBruta,
    comisionesNetas,
    gastosOperativos,
    otrosIngresos,
    utilidadOperativa,
    numFacturas: facturas.length,
    numNC: notasCredito.length,
    sinCosto,
    facturas: facturas.map((f) => {
      const venta = baseFactura(f);
      const costo = f.detalles.reduce((s, d) => s + d.cantidad * d.costoUnitario.toNumber(), 0);
      return { id: f.id, numero: f.numero, cliente: { razonSocial: f.cliente.razonSocial }, venta, costo };
    }),
  };
}

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
  searchParams: Promise<{ mes?: string; comparar?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const { mes, comparar } = await searchParams;
  const modoComparacion = comparar === "anio" ? "anio" : "mes";

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
  const aParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Comparación: contra el mes calendario anterior, o contra el mismo mes del
  // año anterior (más útil si el negocio tiene estacionalidad).
  const inicioComparacion =
    modoComparacion === "anio" ? new Date(anio - 1, mesIdx, 1) : new Date(anio, mesIdx - 1, 1);
  const finComparacion =
    modoComparacion === "anio" ? new Date(anio - 1, mesIdx + 1, 1) : new Date(anio, mesIdx, 1);

  const [actual, anterior, controlesGL] = await Promise.all([
    calcularResultados(inicio, fin),
    calcularResultados(inicioComparacion, finComparacion),
    prisma.controlContable.findMany({ where: { clave: { in: ["VENTAS", "COSTO_VENTAS"] } } }),
  ]);

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
    diferenciaGL = Math.round((ventasGL - actual.ventasBrutas) * 100) / 100;
  }

  const nombreMes = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    inicio
  );
  const nombreComparacion = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(inicioComparacion);

  const pct = (v: number) => (actual.ventasNetas > 0 ? `${((v / actual.ventasNetas) * 100).toFixed(1)}%` : "—");

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between no-imprimir">
        <div className="flex items-center gap-2">
          <Link
            href={`/finanzas/resultados?mes=${aParam(mesAnterior)}&comparar=${modoComparacion}`}
            className="boton-secundario px-2 py-1"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <Link
            href={`/finanzas/resultados?mes=${aParam(mesSiguiente)}&comparar=${modoComparacion}`}
            className="boton-secundario px-2 py-1"
            aria-label="Mes siguiente"
          >
            →
          </Link>
        </div>
        <BotonImprimir />
      </div>

      <div className="flex gap-2 mt-2 no-imprimir text-xs">
        <Link
          href={`/finanzas/resultados?mes=${aParam(inicio)}&comparar=mes`}
          className={`px-2 py-1 rounded-md ${modoComparacion === "mes" ? "boton-primario" : "boton-secundario"}`}
        >
          vs. mes anterior
        </Link>
        <Link
          href={`/finanzas/resultados?mes=${aParam(inicio)}&comparar=anio`}
          className={`px-2 py-1 rounded-md ${modoComparacion === "anio" ? "boton-primario" : "boton-secundario"}`}
        >
          vs. mismo mes año anterior
        </Link>
      </div>

      <div className="documento">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
          Estado de resultados
        </h1>
        <p className="text-neutral-500 mt-1 capitalize">
          {nombreMes} <span className="text-neutral-400">— comparado contra {nombreComparacion}</span>
        </p>

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Concepto</th>
              <th className="text-right">{nombreMes}</th>
              <th className="text-right">{nombreComparacion}</th>
              <th className="text-right">Variación</th>
            </tr>
          </thead>
          <tbody>
            <Fila
              etiqueta={`Ventas facturadas (${actual.numFacturas})`}
              valor={actual.ventasBrutas}
              anterior={anterior.ventasBrutas}
            />
            <Fila
              etiqueta={`(−) Notas de crédito (${actual.numNC})`}
              valor={-actual.totalNC}
              anterior={-anterior.totalNC}
            />
            <FilaTotal
              etiqueta="Ventas netas"
              valor={actual.ventasNetas}
              anterior={anterior.ventasNetas}
              pct={actual.ventasNetas > 0 ? "100%" : "—"}
            />
            <Fila etiqueta="(−) Costo de ventas" valor={-actual.costoVentas} anterior={-anterior.costoVentas} />
            <FilaTotal
              etiqueta="Utilidad bruta"
              valor={actual.utilidadBruta}
              anterior={anterior.utilidadBruta}
              pct={pct(actual.utilidadBruta)}
            />
            <Fila
              etiqueta="(−) Comisiones de vendedores (neto)"
              valor={-actual.comisionesNetas}
              anterior={-anterior.comisionesNetas}
            />
            <Fila
              etiqueta="(−) Gastos operativos (caja)"
              valor={-actual.gastosOperativos}
              anterior={-anterior.gastosOperativos}
            />
            <Fila etiqueta="(+) Otros ingresos (caja)" valor={actual.otrosIngresos} anterior={anterior.otrosIngresos} />
            <FilaTotal
              etiqueta="Utilidad operativa"
              valor={actual.utilidadOperativa}
              anterior={anterior.utilidadOperativa}
              pct={pct(actual.utilidadOperativa)}
              destacada
            />
          </tbody>
        </table>

        {actual.sinCosto && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-4">
            ⚠ Hay ventas del mes con costo S/ 0.00 (facturadas antes de que existiera el costeo o
            de producir con costos registrados). La utilidad bruta de este mes está sobreestimada.
          </p>
        )}
        {diferenciaGL !== null && Math.abs(diferenciaGL) > 0.05 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            ⚠ Las ventas de este mes (S/ {actual.ventasBrutas.toFixed(2)}) no coinciden con lo
            posteado en el libro mayor (diferencia S/ {diferenciaGL.toFixed(2)}) — revise si hubo
            períodos cerrados o controles contables agregados después de facturar. Ver{" "}
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
              {actual.facturas.map((f) => {
                const margen = f.venta - f.costo;
                return (
                  <tr key={f.id}>
                    <td className="font-mono text-xs">
                      <Link href={`/comercial/facturas/${f.id}`} className="hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td>{f.cliente.razonSocial}</td>
                    <td className="text-right">{formatMoneda(f.venta)}</td>
                    <td className="text-right">{formatMoneda(f.costo)}</td>
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
              {actual.facturas.length === 0 && (
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

function variacionPct(actual: number, anterior: number): { texto: string; positiva: boolean | null } {
  if (anterior === 0) {
    if (actual === 0) return { texto: "—", positiva: null };
    return { texto: actual > 0 ? "nuevo" : "nuevo", positiva: actual > 0 };
  }
  const v = ((actual - anterior) / Math.abs(anterior)) * 100;
  return { texto: `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, positiva: v >= 0 };
}

function Fila({ etiqueta, valor, anterior }: { etiqueta: string; valor: number; anterior: number }) {
  const variacion = variacionPct(valor, anterior);
  return (
    <tr>
      <td className="text-neutral-600 dark:text-neutral-400">{etiqueta}</td>
      <td className={`text-right ${valor < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
        {formatMoneda(valor)}
      </td>
      <td className="text-right text-neutral-500">{formatMoneda(anterior)}</td>
      <td
        className={`text-right text-xs ${
          variacion.positiva === null
            ? "text-neutral-400"
            : variacion.positiva
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {variacion.texto}
      </td>
    </tr>
  );
}

function FilaTotal({
  etiqueta,
  valor,
  anterior,
  pct,
  destacada = false,
}: {
  etiqueta: string;
  valor: number;
  anterior: number;
  pct: string;
  destacada?: boolean;
}) {
  const variacion = variacionPct(valor, anterior);
  return (
    <tr className={destacada ? "bg-amber-500/10" : ""}>
      <td className="font-semibold text-neutral-900 dark:text-neutral-100">{etiqueta}</td>
      <td
        className={`text-right font-semibold ${
          valor < 0 ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {formatMoneda(valor)}
        <span className="block text-xs font-normal text-neutral-500">{pct}</span>
      </td>
      <td className="text-right text-neutral-500">{formatMoneda(anterior)}</td>
      <td
        className={`text-right text-xs font-semibold ${
          variacion.positiva === null
            ? "text-neutral-400"
            : variacion.positiva
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {variacion.texto}
      </td>
    </tr>
  );
}
