import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_ESTADO_PEDIDO } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  FACTURADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADO: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const ESTADOS_VALIDOS = ["PENDIENTE", "FACTURADO", "ANULADO"] as const;
  const estadoFiltro = ESTADOS_VALIDOS.find((e) => e === estado);

  const pedidos = await prisma.pedido.findMany({
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
    include: { cliente: true, vendedor: true, factura: true },
    orderBy: { fecha: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Pedidos</h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            El stock se descuenta recién al facturar; un pedido pendiente puede anularse.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Número o cliente...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="FACTURADO">Facturado</option>
            <option value="ANULADO">Anulado</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/comercial/pedidos/nuevo"
        nuevoTexto="Nuevo pedido"
        registros={pedidos.map((p) => ({
          id: p.id,
          href: `/comercial/pedidos/${p.id}`,
          primario: p.numero,
          secundario: p.cliente.razonSocial,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th className="text-right">Total</th>
            <th>Estado</th>
            <th>Factura</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td className="font-mono text-xs">{p.numero}</td>
              <td>{p.cliente.razonSocial}</td>
              <td>{p.vendedor.nombre}</td>
              <td className="text-right">{formatMoneda(p.total)}</td>
              <td>
                <span className={`insignia ${COLOR_ESTADO[p.estado]}`}>
                  {ETIQUETA_ESTADO_PEDIDO[p.estado]}
                </span>
              </td>
              <td className="font-mono text-xs">
                {p.factura ? (
                  <Link href={`/comercial/facturas/${p.factura.id}`} className="hover:underline">
                    {p.factura.numero}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(p.fecha)}
              </td>
              <td className="text-right">
                <Link
                  href={`/comercial/pedidos/${p.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay pedidos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
