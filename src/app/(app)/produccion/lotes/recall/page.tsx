import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";

// Vista de recall: dado un lote granel, agrega TODOS sus envasados y TODOS
// los clientes/facturas que recibieron unidades — de un vistazo, sin tener
// que entrar envasado por envasado (que es como se ve la trazabilidad en el
// detalle de cada Envasado).
export default async function RecallPage({
  searchParams,
}: {
  searchParams: Promise<{ loteId?: string }>;
}) {
  const { loteId } = await searchParams;

  const lotes = await prisma.loteGranel.findMany({
    include: { formula: { include: { producto: true } } },
    orderBy: { fechaInicio: "desc" },
  });

  const lote = loteId
    ? await prisma.loteGranel.findUnique({
        where: { id: loteId },
        include: {
          formula: { include: { producto: true } },
          envasados: {
            include: {
              presentacion: true,
              asignacionesLote: {
                include: {
                  pedidoDetalle: {
                    include: { pedido: { include: { cliente: true, factura: true } } },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  // Neto vigente (ASIGNADA − LIBERADA) por línea de pedido, agregado sobre
  // TODOS los envasados de este lote (a diferencia de la vista por envasado).
  type Destino = {
    cantidad: number;
    clienteNombre: string;
    facturaNumero: string | null;
    pedidoNumero: string;
    envasadoCodigo: string;
  };
  const destinos: Destino[] = [];
  if (lote) {
    for (const e of lote.envasados) {
      const netoPorDetalle = new Map<string, number>();
      for (const a of e.asignacionesLote) {
        const actual = netoPorDetalle.get(a.pedidoDetalleId) ?? 0;
        netoPorDetalle.set(a.pedidoDetalleId, actual + (a.tipo === "ASIGNADA" ? a.cantidad : -a.cantidad));
      }
      for (const a of e.asignacionesLote) {
        const cantidad = netoPorDetalle.get(a.pedidoDetalleId) ?? 0;
        if (cantidad <= 0) continue;
        netoPorDetalle.set(a.pedidoDetalleId, 0); // evita duplicar por cada evento de la misma línea
        destinos.push({
          cantidad,
          clienteNombre: a.pedidoDetalle.pedido.cliente.razonSocial,
          facturaNumero: a.pedidoDetalle.pedido.factura?.numero ?? null,
          pedidoNumero: a.pedidoDetalle.pedido.numero,
          envasadoCodigo: e.codigo,
        });
      }
    }
  }

  const totalUnidadesVendidas = destinos.reduce((acc, d) => acc + d.cantidad, 0);
  const clientesUnicos = new Set(destinos.map((d) => d.clienteNombre)).size;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Trazabilidad / recall por lote
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Busca un lote granel y ve de un vistazo todos sus envasados y todos los clientes/facturas
        que recibieron unidades — útil ante un reclamo de calidad o un recall.
      </p>

      <form method="get" className="mt-5 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Lote granel</span>
          <select name="loteId" defaultValue={loteId ?? ""} className="campo-input min-w-72">
            <option value="" disabled>
              Seleccione
            </option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} — {l.formula.producto.nombre} ({ETIQUETA_ESTADO_LOTE[l.estado]})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton-secundario">
          Buscar
        </button>
      </form>

      {lote && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Dato etiqueta="Envasados de este lote" valor={String(lote.envasados.length)} />
            <Dato etiqueta="Unidades vendidas vigentes" valor={formatNumero(totalUnidadesVendidas, 0)} />
            <Dato etiqueta="Clientes distintos afectados" valor={String(clientesUnicos)} />
            <Dato etiqueta="Estado del lote" valor={ETIQUETA_ESTADO_LOTE[lote.estado]} />
          </div>

          <table className="tabla mt-6">
            <thead>
              <tr>
                <th>Envasado</th>
                <th>Presentación</th>
                <th>Cliente</th>
                <th>Pedido</th>
                <th>Factura</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {destinos.map((d, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs">
                    <Link href={`/produccion/envasados/${lote.envasados.find((e) => e.codigo === d.envasadoCodigo)?.id}`} className="hover:underline">
                      {d.envasadoCodigo}
                    </Link>
                  </td>
                  <td className="text-sm text-neutral-500">
                    {lote.envasados.find((e) => e.codigo === d.envasadoCodigo)?.presentacion.nombre}
                  </td>
                  <td>{d.clienteNombre}</td>
                  <td className="font-mono text-xs">{d.pedidoNumero}</td>
                  <td className="font-mono text-xs">{d.facturaNumero ?? "—"}</td>
                  <td className="text-right">{d.cantidad}</td>
                </tr>
              ))}
              {destinos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-neutral-500 py-6">
                    Este lote todavía no tiene unidades vendidas vigentes en ningún cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
