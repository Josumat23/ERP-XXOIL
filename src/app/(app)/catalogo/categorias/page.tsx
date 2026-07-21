import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CategoriaFormulario from "./CategoriaFormulario";
import { alternarActivoCategoria } from "./actions";

export default async function CategoriasPage() {
  const categorias = await prisma.categoria.findMany({
    include: { _count: { select: { productos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--epicor-texto)" }}>Categorías</h1>
        <BotonImprimir />
      </div>
      <p className="text-[13px] mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Agrupan los productos del catálogo.
      </p>

      <PanelMaestroDetalle
        registros={categorias.map((c) => ({
          id: c.id,
          href: `/catalogo/categorias/${c.id}`,
          primario: c.nombre,
          secundario: c.descripcion ?? undefined,
        }))}
      >
      <div className="max-w-3xl">
        <CategoriaFormulario />

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Productos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.nombre}</td>
                <td className="text-neutral-500">{c.descripcion ?? "—"}</td>
                <td>{c._count.productos}</td>
                <td>
                  <span
                    className={`insignia ${
                      c.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {c.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/catalogo/categorias/${c.id}`}
                      className="text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      Editar
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoCategoria(c.id, !c.activo);
                      }}
                    >
                      <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                        {c.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
