import { prisma } from "@/lib/prisma";
import ZonaFormulario from "./ZonaFormulario";
import { alternarActivoZona } from "./actions";

export default async function ZonasPage() {
  const zonas = await prisma.zona.findMany({
    include: { _count: { select: { vendedores: true, clientes: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Zonas</h1>
      <p className="text-neutral-500 mt-1">Zonas comerciales para vendedores y clientes.</p>

      <div className="mt-6">
        <ZonaFormulario />
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Vendedores</th>
            <th>Clientes</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {zonas.map((z) => (
            <tr key={z.id}>
              <td className="font-medium">{z.nombre}</td>
              <td>{z._count.vendedores}</td>
              <td>{z._count.clientes}</td>
              <td>
                <span
                  className={`insignia ${
                    z.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {z.activo ? "Activa" : "Inactiva"}
                </span>
              </td>
              <td className="text-right">
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoZona(z.id, !z.activo);
                  }}
                >
                  <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                    {z.activo ? "Desactivar" : "Activar"}
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
