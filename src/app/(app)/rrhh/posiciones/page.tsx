import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import {
  cadenaDeMandoPosicion,
  creariaCicloPosicion,
  ocupantesEnFecha,
  posicionesVacantesEnFecha,
} from "@/lib/posicionesOrganizativas";
import {
  AsignarFormulario,
  CerrarAsignacionFormulario,
  PosicionFormulario,
  SuperiorFormulario,
} from "./PosicionFormularios";
import { alternarActivaPosicion } from "./actions";

const formatoFecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });

export default async function PosicionesPage() {
  const usuario = await obtenerUsuarioEmpresaActiva();
  if (!usuario || !(await puedeRealizar(usuario, "rrhh", "ver"))) redirect("/");
  const empresaId = usuario.empresaId;

  const [posiciones, asignaciones, empleados, centrosCosto] = await Promise.all([
    prisma.posicionOrganizativa.findMany({
      where: { empresaId },
      include: { centroCosto: { select: { codigo: true } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.asignacionPosicion.findMany({
      where: { empresaId },
      include: { empleado: { select: { codigo: true, nombres: true, apellidos: true } } },
      orderBy: { vigenteDesde: "desc" },
    }),
    prisma.empleado.findMany({
      where: { empresaId, estado: "ACTIVO" },
      select: { id: true, codigo: true, nombres: true, apellidos: true },
      orderBy: { apellidos: "asc" },
    }),
    prisma.centroCosto.findMany({
      where: { empresaId, activo: true },
      select: { id: true, codigo: true, nombre: true },
      orderBy: { codigo: "asc" },
    }),
  ]);

  const hoy = new Date();
  const periodos = asignaciones.map((a) => ({
    id: a.id,
    posicionId: a.posicionId,
    empleadoId: a.empleadoId,
    vigenteDesde: a.vigenteDesde,
    vigenteHasta: a.vigenteHasta,
  }));
  const nodos = posiciones.map((p) => ({ id: p.id, reportaAId: p.reportaAId }));
  const porId = new Map(posiciones.map((p) => [p.id, p]));
  const vacantes = posicionesVacantesEnFecha(
    posiciones.filter((p) => p.activa).map((p) => p.id),
    hoy,
    periodos
  );
  const opciones = posiciones.map((p) => ({ id: p.id, etiqueta: `${p.codigo} — ${p.titulo}` }));

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--epicor-texto)" }}>
        Posiciones organizativas
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Equivalente reducido a Position de SAP HCM: la posición existe con independencia de quién la
        ocupe, y la ocupación es un período con inicio y fin. Por eso se puede responder quién
        ocupaba una posición en una fecha pasada y qué posiciones están vacantes hoy — cosa que el
        campo de texto libre <span className="font-mono text-xs">cargo</span> nunca permitió.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="insignia bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Posiciones activas: {posiciones.filter((p) => p.activa).length}
        </span>
        <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
          Vacantes hoy: {vacantes.length}
        </span>
      </div>

      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Nueva posición</h2>
        <PosicionFormulario
          posiciones={opciones}
          centrosCosto={centrosCosto.map((c) => ({
            id: c.id,
            etiqueta: `${c.codigo} — ${c.nombre}`,
          }))}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {posiciones.map((posicion) => {
          const ocupantesHoy = ocupantesEnFecha(posicion.id, hoy, periodos);
          const historial = asignaciones.filter((a) => a.posicionId === posicion.id);
          const cadena = cadenaDeMandoPosicion(posicion.id, nodos)
            .map((id) => porId.get(id)?.codigo)
            .filter(Boolean);
          return (
            <div
              key={posicion.id}
              className="border border-black/10 dark:border-white/10 rounded-lg p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    <span className="font-mono text-xs text-neutral-500">{posicion.codigo}</span>{" "}
                    {posicion.titulo}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {posicion.area}
                    {posicion.centroCosto ? ` · Centro de costo: ${posicion.centroCosto.codigo}` : ""}
                    {cadena.length > 0 ? ` · Reporta a: ${cadena.join(" › ")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {ocupantesHoy.length === 0 && posicion.activa && (
                    <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                      Vacante
                    </span>
                  )}
                  <span
                    className={`insignia ${
                      posicion.activa
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {posicion.activa ? "Activa" : "Inactiva"}
                  </span>
                  <SuperiorFormulario
                    id={posicion.id}
                    reportaAIdActual={posicion.reportaAId}
                    opciones={opciones.filter(
                      (o) => !creariaCicloPosicion(posicion.id, o.id, nodos)
                    )}
                  />
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivaPosicion(posicion.id, !posicion.activa);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      {posicion.activa ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </div>

              <table className="tabla mt-3">
                <thead>
                  <tr>
                    <th>Ocupante</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Motivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="font-mono text-xs text-neutral-500">
                          {a.empleado.codigo}
                        </span>{" "}
                        {a.empleado.nombres} {a.empleado.apellidos}
                      </td>
                      <td>{formatoFecha.format(a.vigenteDesde)}</td>
                      <td>{a.vigenteHasta ? formatoFecha.format(a.vigenteHasta) : "Vigente"}</td>
                      <td className="text-sm text-neutral-500">{a.motivo ?? "—"}</td>
                      <td className="text-right">
                        {a.vigenteHasta === null && <CerrarAsignacionFormulario id={a.id} />}
                      </td>
                    </tr>
                  ))}
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-neutral-500 py-3">
                        Sin ocupantes registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {posicion.activa && (
                <div className="mt-3">
                  <AsignarFormulario
                    posicionId={posicion.id}
                    empleados={empleados.map((e) => ({
                      id: e.id,
                      etiqueta: `${e.codigo} — ${e.apellidos}, ${e.nombres}`,
                    }))}
                  />
                </div>
              )}
            </div>
          );
        })}
        {posiciones.length === 0 && (
          <p className="text-neutral-500 text-center py-8 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
            No hay posiciones registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
