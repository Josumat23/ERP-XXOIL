import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { ETIQUETA_ESTADO_DESPACHO } from "@/lib/etiquetas";

export default async function GuiasRemisionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { q } = await searchParams;

  const guias = await prisma.guiaRemision.findMany({
    where: q
      ? { OR: [{ numero: { contains: q } }, { cliente: { razonSocial: { contains: q } } }] }
      : {},
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

      <BarraFiltro q={q} placeholder="Número o cliente..." />

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
            <th>Estado</th>
            <th>Acciones</th>
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
              <td>
                <span
                  className={`insignia ${
                    g.estadoDespacho === "ANULADO"
                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      : g.estadoDespacho === "ENTREGADO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : g.estadoDespacho === "EN_RUTA"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800"
                  }`}
                >
                  {ETIQUETA_ESTADO_DESPACHO[g.estadoDespacho]}
                </span>
              </td>
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
              <td colSpan={8} className="text-center text-neutral-500 py-6">
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
