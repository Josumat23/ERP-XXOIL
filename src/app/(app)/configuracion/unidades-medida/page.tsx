import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { ClaseFormulario, UnidadFormulario } from "./UnidadMedidaFormularios";
import { alternarActivoUnidad } from "./actions";

export default async function UnidadesMedidaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  const clases = await prisma.claseUnidadMedida.findMany({
    include: { unidades: true },
    orderBy: { codigo: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Unidades de medida
      </h1>
      <p className="text-neutral-500 mt-1">
        Equivalente reducido a UOM Class / UOM Maintenance de Epicor. Estas unidades alimentan los
        selectores de productos e insumos.
      </p>

      <div className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva clase</h2>
        <ClaseFormulario />
      </div>

      <div className="mt-4 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva unidad</h2>
        <UnidadFormulario clases={clases.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {clases.map((c) => (
          <div key={c.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              {c.nombre} <span className="text-xs text-neutral-400 font-mono">{c.codigo}</span>
            </p>
            <table className="tabla mt-2">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {c.unidades.map((u) => (
                  <tr key={u.id}>
                    <td className="font-mono text-xs">{u.codigo}</td>
                    <td>{u.nombre}</td>
                    <td>
                      <span
                        className={`insignia ${
                          u.activo
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                        }`}
                      >
                        {u.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="text-right">
                      <form
                        action={async () => {
                          "use server";
                          await alternarActivoUnidad(u.id, !u.activo);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-neutral-600 dark:text-neutral-400 hover:underline"
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {c.unidades.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-neutral-500 py-3">
                      Sin unidades en esta clase.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {clases.length === 0 && (
          <p className="text-neutral-500 text-center py-8 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
            No hay clases de unidad de medida registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
