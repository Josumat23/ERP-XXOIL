import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

export default async function EnvasadosPage() {
  const envasados = await prisma.envasado.findMany({
    include: {
      loteGranel: { include: { formula: { include: { producto: true } } } },
      presentacion: true,
      insumos: { include: { insumo: true } },
    },
    orderBy: { fecha: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--epicor-texto)" }}>Envasados</h1>
          <p className="text-[13px]" style={{ color: "var(--epicor-texto-tenue)" }}>
            Segunda etapa de producción: el granel aprobado se convierte en stock de presentaciones.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <PanelMaestroDetalle
        nuevoHref="/produccion/envasados/nuevo"
        nuevoTexto="Nuevo envasado"
        registros={envasados.map((e) => ({
          id: e.id,
          href: `/produccion/envasados/${e.id}`,
          primario: e.codigo,
          secundario: e.presentacion.nombre,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Lote</th>
            <th>Producto</th>
            <th>Presentación</th>
            <th className="text-right">Unidades</th>
            <th className="text-right">Kg granel</th>
            <th>Envases/etiquetas</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {envasados.map((e) => (
            <tr key={e.id}>
              <td className="font-mono text-xs">{e.codigo}</td>
              <td className="font-mono text-xs">
                <Link href={`/produccion/lotes/${e.loteGranelId}`} className="hover:underline">
                  {e.loteGranel.codigo}
                </Link>
              </td>
              <td>{e.loteGranel.formula.producto.nombre}</td>
              <td>{e.presentacion.nombre}</td>
              <td className="text-right">{e.unidades}</td>
              <td className="text-right">{formatNumero(e.kgConsumidos, 2)}</td>
              <td className="text-xs text-neutral-500">
                {e.insumos.map((i) => `${i.insumo.nombre} × ${i.cantidad.toNumber()}`).join(", ") ||
                  "—"}
              </td>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                  e.fecha
                )}
              </td>
              <td className="text-right">
                <Link
                  href={`/produccion/envasados/${e.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
          {envasados.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-neutral-500 py-6">
                No hay envasados registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
