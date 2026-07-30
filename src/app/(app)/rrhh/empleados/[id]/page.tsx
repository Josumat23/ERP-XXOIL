import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatFecha } from "@/lib/format";
import { saldoVacaciones } from "@/lib/vacaciones";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import PanelDirecciones from "@/components/PanelDirecciones";
import PanelContactos from "@/components/PanelContactos";
import VacacionesFormulario from "./VacacionesFormulario";
import BajaEmpleadoFormulario from "./BajaEmpleadoFormulario";
import { aprobarVacaciones } from "../actions";

const ETIQUETA_CONTRATO: Record<string, string> = {
  PLAZO_FIJO: "Plazo fijo",
  PLAZO_INDETERMINADO: "Plazo indeterminado",
  LOCACION_SERVICIOS: "Locación de servicios",
};

const ETIQUETA_DOCUMENTO: Record<string, string> = {
  DNI: "DNI",
  PASAPORTE: "Pasaporte",
  CARNET_EXTRANJERIA: "CE",
  OTRO: "Doc.",
};

const ETIQUETA_ESTADO_VACACIONES: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

const COLOR_ESTADO_VACACIONES: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function DetalleEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [empleado, empleados] = await Promise.all([
    prisma.empleado.findUnique({
      where: { id },
      include: {
        almacen: true,
        centroCosto: true,
        vacaciones: { orderBy: { fechaInicio: "desc" } },
      },
    }),
    prisma.empleado.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);
  if (!empleado) notFound();

  const diasAprobados = empleado.vacaciones
    .filter((v) => v.estado === "APROBADA")
    .reduce((acc, v) => acc + v.diasSolicitados, 0);
  const saldo = saldoVacaciones(empleado.fechaIngreso, diasAprobados);

  return (
    <div>
      <Link
        href="/rrhh/empleados"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a empleados
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/rrhh/empleados/nuevo"
        nuevoTexto="Nuevo empleado"
        registros={empleados.map((e) => ({
          id: e.id,
          href: `/rrhh/empleados/${e.id}`,
          primario: `${e.nombres} ${e.apellidos}`,
          secundario: e.codigo,
        }))}
      >
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {empleado.nombres} {empleado.apellidos}
          </h1>
          <span
            className={`insignia ${
              empleado.estado === "ACTIVO"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
            }`}
          >
            {empleado.estado === "ACTIVO" ? "Activo" : "Cesado"}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          {empleado.codigo} · {empleado.cargo} · {empleado.area} ·{" "}
          {ETIQUETA_CONTRATO[empleado.tipoContrato]}
          {empleado.almacen ? ` · ${empleado.almacen.nombre}` : ""}
          {empleado.centroCosto ? ` · Centro de costo: ${empleado.centroCosto.codigo}` : ""}
        </p>
        <p className="text-sm text-neutral-500 mt-1">
          Ingresó el {formatFecha(empleado.fechaIngreso)} · Sueldo básico{" "}
          {formatMoneda(empleado.sueldoBasico)}
          {empleado.dni ? ` · ${ETIQUETA_DOCUMENTO[empleado.tipoDocumentoIdentidad]} ${empleado.dni}` : ""}
          {empleado.nacionalidad ? ` · ${empleado.nacionalidad}` : ""}
        </p>
        {(empleado.telefono || empleado.correo) && (
          <p className="text-sm text-neutral-500 mt-1">
            {empleado.telefono}
            {empleado.telefono && empleado.correo ? " · " : ""}
            {empleado.correo}
          </p>
        )}
        {empleado.notas && <p className="text-sm text-neutral-500 mt-2">Notas: {empleado.notas}</p>}
        {empleado.estado === "CESADO" && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Cesado el {empleado.fechaCese && formatFecha(empleado.fechaCese)}. Motivo:{" "}
            {empleado.motivoCese}
          </p>
        )}

        <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Vacaciones</h2>
            <span
              className={`insignia ${
                saldo < 0
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
              }`}
            >
              {saldo.toFixed(1)} días disponibles
            </span>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            30 días/año acumulados proporcionalmente desde el ingreso, menos lo ya aprobado —
            referencial, no reemplaza el cálculo legal exacto de planilla.
          </p>

          {empleado.estado === "ACTIVO" && <VacacionesFormulario empleadoId={empleado.id} />}

          <table className="tabla mt-4">
            <thead>
              <tr>
                <th>Desde</th>
                <th>Hasta</th>
                <th className="text-right">Días</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {empleado.vacaciones.map((v) => (
                <tr key={v.id}>
                  <td>{formatFecha(v.fechaInicio)}</td>
                  <td>{formatFecha(v.fechaFin)}</td>
                  <td className="text-right">{v.diasSolicitados}</td>
                  <td>
                    <span className={`insignia ${COLOR_ESTADO_VACACIONES[v.estado]}`}>
                      {ETIQUETA_ESTADO_VACACIONES[v.estado]}
                    </span>
                    {v.estado === "PENDIENTE" && (
                      <form
                        action={async () => {
                          "use server";
                          await aprobarVacaciones(v.id);
                        }}
                        className="inline ml-2"
                      >
                        <button type="submit" className="text-xs text-neutral-500 hover:underline">
                          Aprobar
                        </button>
                      </form>
                    )}
                    {v.estado === "RECHAZADA" && v.motivoRechazo && (
                      <span className="text-xs text-neutral-400 ml-2">({v.motivoRechazo})</span>
                    )}
                  </td>
                </tr>
              ))}
              {empleado.vacaciones.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-500 py-4">
                    Sin solicitudes de vacaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="mt-8 flex flex-col gap-6">
          <PanelDirecciones
            entidadTipo="Empleado"
            entidadId={empleado.id}
            rutaRevalidar={`/rrhh/empleados/${empleado.id}`}
          />
          <PanelContactos
            entidadTipo="Empleado"
            entidadId={empleado.id}
            rutaRevalidar={`/rrhh/empleados/${empleado.id}`}
          />
          <PanelAdjuntos
            entidadTipo="Empleado"
            entidadId={empleado.id}
            rutaRevalidar={`/rrhh/empleados/${empleado.id}`}
          />
        </div>

        {empleado.estado === "ACTIVO" && (
          <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4">
            <h2 className="font-medium text-red-700 dark:text-red-400 mb-3">Zona de baja</h2>
            <BajaEmpleadoFormulario empleadoId={empleado.id} />
          </section>
        )}
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
