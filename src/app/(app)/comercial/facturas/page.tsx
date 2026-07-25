import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_ESTADO_FACTURA, ETIQUETA_CONDICION_PAGO } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PAGADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const ESTADOS_VALIDOS = ["PENDIENTE", "PAGADA", "ANULADA"] as const;
  const estadoFiltro = ESTADOS_VALIDOS.find((e) => e === estado);

  const facturas = await prisma.factura.findMany({
    where: {
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q } },
              { cliente: { razonSocial: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { cliente: true, vendedor: true },
    orderBy: { fechaEmision: "desc" },
  });

  const hoy = new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Facturas</h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Se emiten en el portal SUNAT; aquí se registra el número y se controla la cobranza.
      </p>

      <BarraFiltro q={q} placeholder="Número o cliente...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADA">Pagada</option>
            <option value="ANULADA">Anulada</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        registros={facturas.map((f) => ({
          id: f.id,
          href: `/comercial/facturas/${f.id}`,
          primario: f.numero,
          secundario: f.cliente.razonSocial,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Condición</th>
            <th>Vencimiento</th>
            <th className="text-right">Total</th>
            <th className="text-right">Saldo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((f) => {
            const vencida =
              f.estado === "PENDIENTE" && f.saldo.toNumber() > 0 && f.fechaVencimiento < hoy;
            return (
              <tr key={f.id}>
                <td className="font-mono text-xs">{f.numero}</td>
                <td>{f.cliente.razonSocial}</td>
                <td>{f.vendedor.nombre}</td>
                <td className="text-sm">{ETIQUETA_CONDICION_PAGO[f.condicionPago]}</td>
                <td
                  className={`text-xs whitespace-nowrap ${
                    vencida ? "text-red-600 dark:text-red-400 font-medium" : "text-neutral-500"
                  }`}
                >
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(f.fechaVencimiento)}
                  {vencida && " (vencida)"}
                </td>
                <td className="text-right">{formatMoneda(f.total)}</td>
                <td className="text-right">{formatMoneda(f.saldo)}</td>
                <td>
                  <span className={`insignia ${COLOR_ESTADO[f.estado]}`}>
                    {ETIQUETA_ESTADO_FACTURA[f.estado]}
                  </span>
                </td>
                <td className="text-right">
                  <Link
                    href={`/comercial/facturas/${f.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            );
          })}
          {facturas.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-neutral-500 py-6">
                No hay facturas registradas. Se crean facturando un pedido.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
