import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ZonaFormulario from "./ZonaFormulario";
import { alternarActivoZona } from "./actions";

export default async function ZonasPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const zonas = await prisma.zona.findMany({
    include: { _count: { select: { vendedores: true, clientes: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Zonas</h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Zonas comerciales para vendedores y clientes.
      </p>

      <PanelMaestroDetalle
        registros={zonas.map((z) => ({
          id: z.id,
          href: `/comercial/zonas/${z.id}`,
          primario: z.nombre,
        }))}
      >
      <div className="max-w-3xl">
        <ZonaFormulario />

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Vendedores</th>
              <th>Clientes</th>
              <th>Estado</th>
              <th>Acciones</th>
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
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/comercial/zonas/${z.id}`}
                      className="text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      Editar
                    </Link>
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
