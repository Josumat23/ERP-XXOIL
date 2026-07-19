import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { alternarActivoProveedor } from "./actions";

export default async function ProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({
    include: { _count: { select: { insumos: true } } },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Proveedores</h1>
          <p className="text-neutral-500 mt-1">Proveedores de materia prima, envases y etiquetas.</p>
        </div>
        <Link href="/catalogo/proveedores/nuevo" className="boton-primario">
          Nuevo proveedor
        </Link>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Razón social</th>
            <th>RUC</th>
            <th>Teléfono</th>
            <th>Insumos</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {proveedores.map((p) => (
            <tr key={p.id}>
              <td>{p.razonSocial}</td>
              <td className="font-mono text-xs">{p.ruc ?? "—"}</td>
              <td>{p.telefono ?? "—"}</td>
              <td>{p._count.insumos}</td>
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
                    href={`/catalogo/proveedores/${p.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Editar
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoProveedor(p.id, !p.activo);
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
          {proveedores.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                No hay proveedores registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
