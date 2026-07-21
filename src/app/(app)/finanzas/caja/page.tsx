import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_MEDIO_PAGO } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CajaFormulario from "./CajaFormulario";

export default async function CajaPage() {
  const movimientos = await prisma.movimientoCaja.findMany({
    orderBy: { fecha: "desc" },
    take: 200,
  });

  const totales = await prisma.movimientoCaja.groupBy({
    by: ["tipo"],
    _sum: { monto: true },
  });
  const ingresos = totales.find((t) => t.tipo === "INGRESO")?._sum.monto?.toNumber() ?? 0;
  const egresos = totales.find((t) => t.tipo === "EGRESO")?._sum.monto?.toNumber() ?? 0;
  const saldo = ingresos - egresos;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--epicor-texto)" }}>Libro de caja</h1>
        <BotonImprimir />
      </div>
      <p className="text-[13px] mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Los cobros de facturas y pagos a proveedores se registran automáticamente; aquí también se
        anotan movimientos manuales.
      </p>

      <PanelMaestroDetalle
        registros={movimientos.map((m) => ({
          id: m.id,
          href: `#mov-${m.id}`,
          primario: m.concepto,
          secundario: m.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        }))}
      >
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        <Kpi etiqueta="Ingresos acumulados" valor={formatMoneda(ingresos)} />
        <Kpi etiqueta="Egresos acumulados" valor={formatMoneda(egresos)} />
        <Kpi etiqueta="Saldo de caja" valor={formatMoneda(saldo)} destacado />
      </div>

      <div className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
          Movimiento manual
        </h2>
        <CajaFormulario />
      </div>

      <table className="tabla tabla-densa mt-6">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Concepto</th>
            <th>Medio</th>
            <th>Usuario</th>
            <th className="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id} id={`mov-${m.id}`}>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                  m.fecha
                )}
              </td>
              <td>{m.concepto}</td>
              <td>{ETIQUETA_MEDIO_PAGO[m.medioPago]}</td>
              <td className="text-sm">{m.usuarioNombre}</td>
              <td
                className={`text-right font-medium ${
                  m.tipo === "INGRESO"
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {m.tipo === "INGRESO" ? "+" : "−"}
                {formatMoneda(m.monto)}
              </td>
            </tr>
          ))}
          {movimientos.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                Sin movimientos de caja todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        destacado
          ? "border-neutral-900 dark:border-white"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <p className="text-sm text-neutral-500">{etiqueta}</p>
      <p className="text-2xl font-semibold mt-1 text-neutral-900 dark:text-neutral-100">{valor}</p>
    </div>
  );
}
