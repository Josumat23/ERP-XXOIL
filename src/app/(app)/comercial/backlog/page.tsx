import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import BarraFiltro from "@/components/BarraFiltro";

const MS_POR_DIA = 1000 * 60 * 60 * 24;

function tramoAntiguedad(dias: number): { etiqueta: string; color: string } {
  if (dias <= 7) {
    return { etiqueta: "0-7 días", color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" };
  }
  if (dias <= 15) {
    return { etiqueta: "8-15 días", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" };
  }
  if (dias <= 30) {
    return { etiqueta: "16-30 días", color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400" };
  }
  return { etiqueta: "+30 días", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" };
}

export default async function BacklogPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const pedidos = await prisma.pedido.findMany({
    where: {
      estado: "PENDIENTE",
      ...(q
        ? { OR: [{ numero: { contains: q } }, { cliente: { razonSocial: { contains: q } } }] }
        : {}),
    },
    include: { cliente: true, vendedor: true, detalles: true },
    orderBy: { fecha: "asc" },
  });

  const hoy = new Date();
  const totalBacklog = pedidos.reduce((acc, p) => acc + p.total.toNumber(), 0);
  const diasPromedio =
    pedidos.length > 0
      ? pedidos.reduce((acc, p) => acc + Math.floor((hoy.getTime() - p.fecha.getTime()) / MS_POR_DIA), 0) /
        pedidos.length
      : 0;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Backlog de pedidos
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Pedidos aceptados pero aún no facturados, ordenados por antigüedad — cuánta venta comprometida
        sigue sin despachar.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 max-w-2xl">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Pedidos pendientes</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {pedidos.length}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Valor del backlog</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatMoneda(totalBacklog)}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Antigüedad promedio</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {diasPromedio.toFixed(0)} días
          </p>
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Número o cliente..." />

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Fecha</th>
            <th>Antigüedad</th>
            <th className="text-right">Líneas</th>
            <th className="text-right">Total</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => {
            const dias = Math.floor((hoy.getTime() - p.fecha.getTime()) / MS_POR_DIA);
            const tramo = tramoAntiguedad(dias);
            return (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.numero}</td>
                <td>{p.cliente.razonSocial}</td>
                <td>{p.vendedor.nombre}</td>
                <td className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(p.fecha)}
                </td>
                <td>
                  <span className={`insignia ${tramo.color}`}>{tramo.etiqueta}</span>
                </td>
                <td className="text-right">{p.detalles.length}</td>
                <td className="text-right font-medium">{formatMoneda(p.total)}</td>
                <td className="text-right">
                  <Link
                    href={`/comercial/pedidos/${p.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay pedidos pendientes de facturar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
