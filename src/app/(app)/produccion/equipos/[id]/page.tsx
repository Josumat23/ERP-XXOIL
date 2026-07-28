import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatFecha, formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";

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
  const { id } = await params;

  const [equipo, equipos] = await Promise.all([
    prisma.equipo.findUnique({
      where: { id },
      include: {
        almacen: true,
        activoFijo: true,
        ordenesMantenimiento: { orderBy: { fechaProgramada: "desc" } },
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
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
