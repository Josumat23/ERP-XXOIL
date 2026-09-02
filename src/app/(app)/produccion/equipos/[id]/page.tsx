import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha, formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import ContadorFormulario from "./ContadorFormulario";
import PlanMantenimientoFormulario from "./PlanMantenimientoFormulario";
import { alternarActivoPlan } from "../actions";
import { planVencido } from "@/lib/mantenimientoPreventivo";

const ETIQUETA_ESTADO: Record<string, string> = {
  PROGRAMADA: "Programada",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const COLOR_ESTADO: Record<string, string> = {
  PROGRAMADA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  EN_PROCESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  COMPLETADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function DetalleEquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { id } = await params;

  const [equipo, equipos] = await Promise.all([
    prisma.equipo.findUnique({
      where: { id },
      include: {
        almacen: true,
        activoFijo: true,
        centroCosto: true,
        centroTrabajo: true,
        ordenesMantenimiento: { orderBy: { fechaProgramada: "desc" } },
        planesMantenimiento: { orderBy: { creadoEn: "desc" } },
      },
    }),
    prisma.equipo.findMany({ orderBy: { creadoEn: "desc" } }),
  ]);
  if (!equipo) notFound();

  return (
    <div>
      <Link
        href="/produccion/equipos"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a equipos
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/produccion/equipos/nuevo"
        nuevoTexto="Nuevo equipo"
        registros={equipos.map((e) => ({
          id: e.id,
          href: `/produccion/equipos/${e.id}`,
          primario: e.nombre,
          secundario: e.codigo,
        }))}
      >
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {equipo.nombre}
          </h1>
          <span
            className={`insignia ${
              equipo.activo
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
            }`}
          >
            {equipo.activo ? "Activo" : "Inactivo"}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          {equipo.codigo} · {equipo.almacen.nombre}
          {equipo.centroCosto ? ` · Centro de costo: ${equipo.centroCosto.codigo}` : ""}
          {equipo.centroTrabajo ? ` · Centro de trabajo: ${equipo.centroTrabajo.codigo}` : ""}
        </p>

        {equipo.activoFijo && (
          <p className="text-sm text-neutral-500 mt-2">
            Enlazado al activo fijo{" "}
            <Link
              href={`/finanzas/activos-fijos/${equipo.activoFijo.id}`}
              className="hover:underline font-mono"
            >
              {equipo.activoFijo.codigo}
            </Link>{" "}
            — costo {formatMoneda(equipo.activoFijo.costoAdquisicion)}, depreciación acumulada{" "}
            {formatMoneda(equipo.activoFijo.depreciacionAcumulada)}.
          </p>
        )}

        {equipo.notas && <p className="text-sm text-neutral-500 mt-2">Notas: {equipo.notas}</p>}

        {equipo.unidadContador && (
          <div className="mt-4">
            <ContadorFormulario
              equipoId={equipo.id}
              contadorActual={equipo.contadorActual.toNumber()}
              unidadContador={equipo.unidadContador}
            />
          </div>
        )}

        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            Planes de mantenimiento preventivo
          </h2>
          <p className="text-xs text-neutral-500 mb-3">
            Genera órdenes de mantenimiento automáticamente cuando se cumple el ciclo (tarea
            programada cada hora — ver Configuración → Tareas programadas).
          </p>
          <PlanMantenimientoFormulario equipoId={equipo.id} tieneUnidadContador={!!equipo.unidadContador} />
          <table className="tabla mt-4">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Ciclo</th>
                <th>Última ejecución</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {equipo.planesMantenimiento.map((p) => {
                const vencido =
                  p.activo &&
                  planVencido(
                    {
                      tipo: p.tipo,
                      frecuenciaDias: p.frecuenciaDias,
                      frecuenciaContador: p.frecuenciaContador?.toNumber() ?? null,
                      ultimaEjecucionFecha: p.ultimaEjecucionFecha,
                      ultimaEjecucionContador: p.ultimaEjecucionContador?.toNumber() ?? null,
                      creadoEn: p.creadoEn,
                    },
                    equipo.contadorActual.toNumber()
                  );
                return (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td className="text-sm text-neutral-500">
                      {p.tipo === "POR_TIEMPO"
                        ? `Cada ${p.frecuenciaDias} días`
                        : `Cada ${p.frecuenciaContador?.toString()} ${equipo.unidadContador ?? ""}`}
                    </td>
                    <td className="text-sm text-neutral-500">
                      {p.tipo === "POR_TIEMPO"
                        ? p.ultimaEjecucionFecha
                          ? formatFecha(p.ultimaEjecucionFecha)
                          : "Nunca"
                        : p.ultimaEjecucionContador
                          ? `${p.ultimaEjecucionContador.toString()} ${equipo.unidadContador ?? ""}`
                          : "Nunca"}
                    </td>
                    <td>
                      {!p.activo ? (
                        <span className="insignia bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                          Inactivo
                        </span>
                      ) : vencido ? (
                        <span className="insignia bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400">
                          Vencido
                        </span>
                      ) : (
                        <span className="insignia bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                          Al día
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <form
                        action={async () => {
                          "use server";
                          await alternarActivoPlan(p.id, equipo.id, !p.activo);
                        }}
                      >
                        <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline text-sm">
                          {p.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {equipo.planesMantenimiento.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-4">
                    Sin planes preventivos registrados — todo el mantenimiento es correctivo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Órdenes de mantenimiento
            </h2>
            <Link
              href={`/produccion/mantenimiento/nuevo?equipoId=${equipo.id}`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              + Nueva orden
            </Link>
          </div>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Programada</th>
                <th>Estado</th>
                <th className="text-right">Costo</th>
              </tr>
            </thead>
            <tbody>
              {equipo.ordenesMantenimiento.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">
                    <Link href={`/produccion/mantenimiento/${o.id}`} className="hover:underline">
                      {o.codigo}
                    </Link>
                  </td>
                  <td>{o.tipo === "PREVENTIVO" ? "Preventivo" : "Correctivo"}</td>
                  <td>
                    {formatFecha(o.fechaProgramada)}
                    {o.duracionDias > 1 ? ` (${o.duracionDias} días)` : ""}
                  </td>
                  <td>
                    <span className={`insignia ${COLOR_ESTADO[o.estado]}`}>
                      {ETIQUETA_ESTADO[o.estado]}
                    </span>
                  </td>
                  <td className="text-right">
                    {formatMoneda(o.costoManoObra.toNumber() + o.costoRepuestos.toNumber())}
                  </td>
                </tr>
              ))}
              {equipo.ordenesMantenimiento.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-4">
                    Sin órdenes de mantenimiento registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="mt-8">
          <PanelAdjuntos
            entidadTipo="Equipo"
            entidadId={equipo.id}
            rutaRevalidar={`/produccion/equipos/${equipo.id}`}
          />
        </div>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
