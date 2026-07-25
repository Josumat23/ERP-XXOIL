import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

export default async function GuiasRemisionPage() {
  const guias = await prisma.guiaRemision.findMany({
    include: { cliente: true, factura: true, _count: { select: { detalles: true } } },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Guías de remisión
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Documentan el traslado de mercadería (formato SUNAT). Se imprimen para acompañar el
            transporte.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <PanelMaestroDetalle
        nuevoHref="/logistica/guias-remision/nueva"
        nuevoTexto="Nueva guía"
        registros={guias.map((g) => ({
          id: g.id,
          href: `/logistica/guias-remision/${g.id}`,
          primario: g.numero,
          secundario: g.cliente.razonSocial,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Factura</th>
            <th>Traslado</th>
            <th>Destino</th>
            <th>Líneas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {guias.map((g) => (
            <tr key={g.id}>
              <td className="font-mono text-xs">{g.numero}</td>
              <td>{g.cliente.razonSocial}</td>
              <td className="font-mono text-xs">
                {g.factura ? (
                  <Link href={`/comercial/facturas/${g.factura.id}`} className="hover:underline">
                    {g.factura.numero}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(g.fechaTraslado)}
              </td>
              <td className="text-sm text-neutral-500 max-w-56 truncate">{g.puntoLlegada}</td>
              <td>{g._count.detalles}</td>
              <td className="text-right">
                <Link
                  href={`/logistica/guias-remision/${g.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver / imprimir
                </Link>
              </td>
            </tr>
          ))}
          {guias.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                No hay guías de remisión registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
