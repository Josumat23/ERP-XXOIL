import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

export default async function FormulasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;

  const formulas = await prisma.formula.findMany({
    where: {
      ...(estado === "activa" ? { activo: true } : estado === "inactiva" ? { activo: false } : {}),
      ...(q ? { producto: { nombre: { contains: q } } } : {}),
    },
    include: {
      producto: true,
      _count: { select: { detalles: true, lotes: true } },
    },
    orderBy: [{ producto: { nombre: "asc" } }, { version: "desc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Fórmulas</h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Recetas de producción por producto. No se editan: cada cambio crea una versión nueva, y
            solo una versión por producto puede estar vigente a la vez.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Producto...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todas</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/produccion/formulas/nueva"
        nuevoTexto="Nueva versión"
        registros={formulas.map((f) => ({
          id: f.id,
          href: `/produccion/formulas/${f.id}`,
          primario: f.producto.nombre,
          secundario: `v${f.version}`,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Versión</th>
            <th className="text-right">Batch (kg)</th>
            <th>Insumos</th>
            <th>Lotes producidos</th>
            <th>Estado</th>
            <th>Vigencia</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {formulas.map((f) => (
            <tr key={f.id}>
              <td className="font-medium">{f.producto.nombre}</td>
              <td className="font-mono text-xs">v{f.version}</td>
              <td className="text-right">{formatNumero(f.rendimientoKg, 2)}</td>
              <td>{f._count.detalles}</td>
              <td>{f._count.lotes}</td>
              <td>
                <span
                  className={`insignia ${
                    f.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {f.activo ? "Activa" : "Inactiva"}
                </span>
              </td>
              <td className="text-xs text-neutral-500">
                {f.vigenteDesde
                  ? `Desde ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(f.vigenteDesde)}${
                      f.vigenteHasta
                        ? ` hasta ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(f.vigenteHasta)}`
                        : ""
                    }`
                  : "—"}
              </td>
              <td className="text-right">
                <Link
                  href={`/produccion/formulas/${f.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
          {formulas.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay fórmulas registradas. Cree la primera versión para poder producir lotes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
