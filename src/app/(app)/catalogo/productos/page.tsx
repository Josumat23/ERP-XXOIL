import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { alternarActivoProducto } from "./actions";

export default async function ProductosPage() {
  const productos = await prisma.producto.findMany({
    include: { categoria: true, _count: { select: { presentaciones: true } } },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Productos
          </h1>
          <p className="text-neutral-500 mt-1">
            Catálogo maestro de productos (grasas, aceites, siliconas).
          </p>
        </div>
        <Link href="/catalogo/productos/nuevo" className="boton-primario">
          Nuevo producto
        </Link>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
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
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                No hay productos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
