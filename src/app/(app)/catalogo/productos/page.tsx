import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { alternarActivoProducto } from "./actions";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoriaId?: string }>;
}) {
  const { q, categoriaId } = await searchParams;

  const categorias = await prisma.categoria.findMany({ orderBy: { nombre: "asc" } });

  const productos = await prisma.producto.findMany({
    where: {
      ...(categoriaId ? { categoriaId } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q } },
              { codigo: { contains: q } },
              { marca: { contains: q } },
            ],
          }
        : {}),
    },
    include: { categoria: true, _count: { select: { presentaciones: true } } },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Productos
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Catálogo maestro de productos (grasas, aceites, siliconas).
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Nombre, código o marca...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Categoría</span>
          <select name="categoriaId" defaultValue={categoriaId ?? ""} className="campo-input">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/catalogo/productos/nuevo"
        nuevoTexto="Nuevo producto"
        registros={productos.map((p) => ({
          id: p.id,
          href: `/catalogo/productos/${p.id}`,
          primario: p.nombre,
          secundario: p.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Marca</th>
            <th>UM base</th>
            <th>Especificación</th>
            <th>Presentaciones</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td className="font-mono text-xs">{p.codigo}</td>
              <td>{p.nombre}</td>
              <td>{p.categoria.nombre}</td>
              <td>{p.marca ?? "—"}</td>
              <td>{p.unidadMedidaBase}</td>
              <td className="text-sm text-neutral-500">
                {p.gradoNlgi ? `NLGI ${p.gradoNlgi}` : p.viscosidad ?? "—"}
              </td>
              <td>{p._count.presentaciones}</td>
              <td>
                <span
                  className={`insignia ${
                    p.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {p.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-3">
                  <Link
                    href={`/catalogo/productos/${p.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Editar
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoProducto(p.id, !p.activo);
                    }}
                  >
                    <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                      {p.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {productos.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-neutral-500 py-6">
                No hay productos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
