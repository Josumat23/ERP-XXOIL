import { prisma } from "@/lib/prisma";
import CategoriaFormulario from "./CategoriaFormulario";
import { alternarActivoCategoria } from "./actions";

export default async function CategoriasPage() {
  const categorias = await prisma.categoria.findMany({
    include: { _count: { select: { productos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Categorías</h1>
      <p className="text-neutral-500 mt-1">Agrupan los productos del catálogo.</p>

      <div className="mt-6">
        <CategoriaFormulario />
      </div>

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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
