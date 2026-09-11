import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import {
  etiquetaRutaUbicacion,
  idsSubarbolUbicacion,
  ordenarArbolUbicaciones,
} from "@/lib/ubicacionesTecnicas";
import { UbicacionFormulario, ReubicarFormulario } from "./UbicacionFormularios";
import { alternarActivoUbicacionTecnica } from "./actions";

export default async function UbicacionesTecnicasPage() {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");
  const empresaId = usuario.empresaId;

  const [ubicaciones, plantas] = await Promise.all([
    prisma.ubicacionTecnica.findMany({
      where: { empresaId },
      include: {
        almacen: { select: { nombre: true } },
        _count: { select: { equipos: true } },
      },
      orderBy: { codigo: "asc" },
    }),
    prisma.almacen.findMany({
      where: { empresaId, tipo: "PLANTA", activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const nodos = ubicaciones.map((u) => ({
    id: u.id,
    parentId: u.parentId,
    codigo: u.codigo,
    nombre: u.nombre,
  }));
  const arbol = ordenarArbolUbicaciones(nodos);
  const opciones = arbol.map(({ ubicacion }) => ({
    id: ubicacion.id,
    etiqueta: `${etiquetaRutaUbicacion(ubicacion.id, nodos)} — ${ubicacion.nombre}`,
  }));
  const porId = new Map(ubicaciones.map((u) => [u.id, u]));

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
            Ubicaciones técnicas
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
            Equivalente reducido a Functional Location de SAP PM: el sitio donde vive un equipo, en
            jerarquía de niveles (planta → línea → estación). Un equipo puede cambiarse de sitio sin
            perder su historial: las órdenes y avisos siguen colgando del equipo.
          </p>
        </div>
        <Link href="/produccion/mantenimiento" className="boton-secundario">
          Volver
        </Link>
      </div>

      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva ubicación</h2>
        <UbicacionFormulario ubicaciones={opciones} plantas={plantas} />
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Ubicación</th>
            <th>Planta</th>
            <th>Equipos</th>
            <th>Estado</th>
            <th>Mover</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {arbol.map(({ ubicacion, nivel }) => {
            const fila = porId.get(ubicacion.id);
            if (!fila) return null;
            // Una ubicación no puede colgarse de sí misma ni de un descendiente.
            const descendientes = new Set(idsSubarbolUbicacion(ubicacion.id, nodos));
            return (
              <tr key={ubicacion.id}>
                <td style={{ paddingLeft: `${nivel * 1.25 + 0.5}rem` }}>
                  <span className="font-mono text-xs text-neutral-500">{fila.codigo}</span>{" "}
                  {fila.nombre}
                </td>
                <td className="text-sm text-neutral-500">{fila.almacen?.nombre ?? "—"}</td>
                <td>{fila._count.equipos}</td>
                <td>
                  <span
                    className={`insignia ${
                      fila.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {fila.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td>
                  <ReubicarFormulario
                    id={ubicacion.id}
                    parentIdActual={fila.parentId}
                    opciones={opciones.filter((o) => !descendientes.has(o.id))}
                  />
                </td>
                <td className="text-right">
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoUbicacionTecnica(ubicacion.id, !fila.activo);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      {fila.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          {arbol.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                Sin ubicaciones técnicas registradas. Empiece por una raíz asociada a una planta.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
