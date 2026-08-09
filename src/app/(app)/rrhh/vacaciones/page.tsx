import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatFecha } from "@/lib/format";
import { aprobarVacaciones } from "../empleados/actions";
import RechazarVacacionesFormulario from "./RechazarVacacionesFormulario";

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function VacacionesPage() {
  const solicitudes = await prisma.solicitudVacaciones.findMany({
    include: { empleado: true },
    orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }],
    take: 100,
  });

  return (
    <div>
      <Link
        href="/rrhh/empleados"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a empleados
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-1" style={{ color: "var(--epicor-texto)" }}>
        Solicitudes de vacaciones
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Pendientes primero. Aprobar/rechazar desde acá o desde la ficha del empleado.
      </p>

      <table className="tabla">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Desde</th>
            <th>Hasta</th>
            <th className="text-right">Días</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/rrhh/empleados/${s.empleadoId}`} className="hover:underline">
                  {s.empleado.nombres} {s.empleado.apellidos}
                </Link>
                <span className="text-xs text-neutral-400 font-mono ml-1">{s.empleado.codigo}</span>
              </td>
              <td>{formatFecha(s.fechaInicio)}</td>
              <td>{formatFecha(s.fechaFin)}</td>
              <td className="text-right">{s.diasSolicitados}</td>
              <td>
                <span className={`insignia ${COLOR_ESTADO[s.estado]}`}>{ETIQUETA_ESTADO[s.estado]}</span>
                {s.estado === "RECHAZADA" && s.motivoRechazo && (
                  <span className="text-xs text-neutral-400 ml-2">({s.motivoRechazo})</span>
                )}
              </td>
              <td className="text-right">
                {s.estado === "PENDIENTE" && (
                  <div className="flex items-center gap-2 justify-end">
                    <form
                      action={async () => {
                        "use server";
                        await aprobarVacaciones(s.id);
                      }}
                    >
                      <button type="submit" className="boton-secundario text-xs px-2 py-1">
                        Aprobar
                      </button>
                    </form>
                    <RechazarVacacionesFormulario solicitudId={s.id} />
                  </div>
                )}
              </td>
            </tr>
          ))}
          {solicitudes.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                No hay solicitudes de vacaciones registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
