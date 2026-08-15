import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

export default async function EnvasadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { q } = await searchParams;

  const envasados = await prisma.envasado.findMany({
    where: q
      ? {
          OR: [
            { codigo: { contains: q } },
            { presentacion: { nombre: { contains: q } } },
            { presentacion: { sku: { contains: q } } },
          ],
        }
      : {},
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
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Envasados</h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Segunda etapa de producción: el granel aprobado se convierte en stock de presentaciones.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Código, SKU o presentación..." />

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
            <th>Acciones</th>
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
