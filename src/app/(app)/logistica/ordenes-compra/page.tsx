import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_ESTADO_OC, ETIQUETA_ESTADO_APROBACION } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PARCIAL: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  RECIBIDA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

const COLOR_APROBACION: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function OrdenesCompraPage() {
  const ordenes = await prisma.ordenCompra.findMany({
    include: { proveedor: true, _count: { select: { recepciones: true } } },
    orderBy: { fecha: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Órdenes de compra
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Compras de insumos a proveedores. La recepción alimenta el kardex, actualiza el costo
            promedio y genera la cuenta por pagar.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <PanelMaestroDetalle
        nuevoHref="/logistica/ordenes-compra/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((oc) => ({
          id: oc.id,
          href: `/logistica/ordenes-compra/${oc.id}`,
          primario: oc.numero,
          secundario: oc.proveedor.razonSocial,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Proveedor</th>
            <th className="text-right">Total</th>
            <th>Recepciones</th>
            <th>Estado</th>
            <th>Aprobación</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((oc) => (
            <tr key={oc.id}>
              <td className="font-mono text-xs">{oc.numero}</td>
              <td>{oc.proveedor.razonSocial}</td>
              <td className="text-right">{formatMoneda(oc.total)}</td>
              <td>{oc._count.recepciones}</td>
              <td>
                <span className={`insignia ${COLOR_ESTADO[oc.estado]}`}>
                  {ETIQUETA_ESTADO_OC[oc.estado]}
                </span>
              </td>
              <td>
                {oc.estadoAprobacion === "NO_REQUERIDA" ? (
                  <span className="text-xs text-neutral-400">—</span>
                ) : (
                  <span className={`insignia ${COLOR_APROBACION[oc.estadoAprobacion]}`}>
                    {ETIQUETA_ESTADO_APROBACION[oc.estadoAprobacion]}
                  </span>
                )}
              </td>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(oc.fecha)}
              </td>
              <td className="text-right">
                <Link
                  href={`/logistica/ordenes-compra/${oc.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
          {ordenes.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay órdenes de compra registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
