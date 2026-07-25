import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { AlmacenFormulario, ZonaFormulario } from "./AlmacenFormularios";
import { alternarActivoAlmacen, alternarActivoZona } from "./actions";

export default async function AlmacenesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "ALMACEN")) redirect("/");

  const almacenes = await prisma.almacen.findMany({
    include: {
      zonas: { include: { _count: { select: { presentaciones: true, insumos: true } } } },
    },
    orderBy: { codigo: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Almacenes y zonas
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Equivalente reducido a Warehouse / Warehouse Zone de Epicor: define dónde vive físicamente
        cada presentación e insumo, en vez de texto libre.
      </p>

      <PanelMaestroDetalle
        registros={almacenes.map((a) => ({
          id: a.id,
          href: `#almacen-${a.id}`,
          primario: a.nombre,
          secundario: a.codigo,
        }))}
      >
      <div className="max-w-4xl">
      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nuevo almacén</h2>
        <AlmacenFormulario />
      </div>

      <div className="mt-4 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva zona</h2>
        <ZonaFormulario almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))} />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {almacenes.map((a) => (
          <div key={a.id} id={`almacen-${a.id}`} className="border border-black/10 dark:border-white/10 rounded-lg p-4 scroll-mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {a.nombre} <span className="text-xs text-neutral-400 font-mono">{a.codigo}</span>
                </p>
                {(a.direccion || a.distrito || a.provincia || a.departamento) && (
                  <p className="text-sm text-neutral-500">
                    {[a.direccion, a.direccion2, a.distrito, a.provincia, a.departamento, a.pais]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {a.encargado && (
                  <p className="text-xs text-neutral-400">Encargado: {a.encargado}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`insignia ${
                    a.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {a.activo ? "Activo" : "Inactivo"}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoAlmacen(a.id, !a.activo);
                  }}
                >
                  <button type="submit" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
                    {a.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>
            </div>

            <table className="tabla mt-3">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Descripción</th>
                  <th>Presentaciones</th>
                  <th>Insumos</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {a.zonas.map((z) => (
                  <tr key={z.id}>
                    <td className="font-mono text-xs">{z.codigo}</td>
                    <td className="text-neutral-500">{z.nombre ?? "—"}</td>
                    <td>{z._count.presentaciones}</td>
                    <td>{z._count.insumos}</td>
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
                        <button
                          type="submit"
                          className="text-neutral-600 dark:text-neutral-400 hover:underline"
                        >
                          {z.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {a.zonas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-neutral-500 py-3">
                      Sin zonas registradas en este almacén.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {almacenes.length === 0 && (
          <p className="text-neutral-500 text-center py-8 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
            No hay almacenes registrados todavía.
          </p>
        )}
      </div>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
