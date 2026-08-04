import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatFecha, formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import CompletarFormulario from "../CompletarFormulario";
import {
  completarOrdenMantenimiento,
  iniciarOrdenMantenimiento,
  cancelarOrdenMantenimiento,
} from "../actions";

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

export default async function DetalleOrdenMantenimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [orden, ordenes, insumosActivos] = await Promise.all([
    prisma.ordenMantenimiento.findUnique({
      where: { id },
      include: {
        equipo: { include: { almacen: true, centroCosto: true } },
        centroCosto: true,
        planMantenimiento: true,
        repuestos: { include: { insumo: true }, orderBy: { creadoEn: "asc" } },
      },
    }),
    prisma.ordenMantenimiento.findMany({
      include: { equipo: true },
      orderBy: { fechaProgramada: "desc" },
    }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!orden) notFound();

  const insumosParaFormulario = insumosActivos.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidadMedida: i.unidadMedida,
    costoUnitario: i.costoUnitario.toNumber(),
    stock: i.stock.toNumber(),
  }));

  const centroEfectivo = orden.centroCosto ?? orden.equipo.centroCosto;

  return (
    <div>
      <Link
        href="/produccion/mantenimiento"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a mantenimiento
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/produccion/mantenimiento/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/produccion/mantenimiento/${o.id}`,
          primario: o.equipo.nombre,
          secundario: o.codigo,
        }))}
      >
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {orden.codigo}
          </h1>
          <span className={`insignia ${COLOR_ESTADO[orden.estado]}`}>
            {ETIQUETA_ESTADO[orden.estado]}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          <Link href={`/produccion/equipos/${orden.equipo.id}`} className="hover:underline">
            {orden.equipo.nombre}
          </Link>{" "}
          ({orden.equipo.almacen.nombre}) · {orden.tipo === "PREVENTIVO" ? "Preventivo" : "Correctivo"}{" "}
          · Programada para el {formatFecha(orden.fechaProgramada)}
          {orden.duracionDias > 1 ? ` (${orden.duracionDias} días)` : ""}
          {centroEfectivo ? ` · Centro de costo: ${centroEfectivo.codigo}` : ""}
        </p>
        <p className="text-sm text-neutral-500 mt-2">{orden.descripcion}</p>
        {orden.planMantenimiento && (
          <p className="text-xs text-neutral-400 mt-1">
            Generada por el plan preventivo{" "}
            <Link href={`/produccion/equipos/${orden.equipo.id}`} className="hover:underline">
              {orden.planMantenimiento.nombre}
            </Link>
            .
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <Dato etiqueta="Mano de obra" valor={formatMoneda(orden.costoManoObra)} />
          <Dato etiqueta="Repuestos" valor={formatMoneda(orden.costoRepuestos)} />
          <Dato
            etiqueta="Costo total"
            valor={formatMoneda(orden.costoManoObra.toNumber() + orden.costoRepuestos.toNumber())}
          />
          <Dato
            etiqueta="Inicio real"
            valor={orden.fechaInicio ? formatFecha(orden.fechaInicio) : "—"}
          />
        </div>

        {orden.observaciones && (
          <p className="text-sm text-neutral-500 mt-4">Trabajo realizado: {orden.observaciones}</p>
        )}

        {orden.repuestos.length > 0 && (
          <section className="mt-8">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
              Repuestos consumidos
            </h2>
            <table className="tabla mt-2">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Costo unit.</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orden.repuestos.map((r) => (
                  <tr key={r.id}>
                    <td>{r.insumo.nombre}</td>
                    <td className="text-right">
                      {r.cantidad.toString()} {r.insumo.unidadMedida}
                    </td>
                    <td className="text-right">{formatMoneda(r.costoUnitario)}</td>
                    <td className="text-right">
                      {formatMoneda(r.cantidad.toNumber() * r.costoUnitario.toNumber())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {orden.estado === "PROGRAMADA" && (
          <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <form
                action={async () => {
                  "use server";
                  await iniciarOrdenMantenimiento(id);
                }}
              >
                <button type="submit" className="boton-primario">
                  Iniciar trabajo
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await cancelarOrdenMantenimiento(id);
                }}
              >
                <button type="submit" className="boton-secundario">
                  Cancelar orden
                </button>
              </form>
            </div>
            <div className="border-t border-black/10 dark:border-white/10 pt-4">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Completar directamente
              </h2>
              <CompletarFormulario
                accion={completarOrdenMantenimiento.bind(null, id)}
                insumos={insumosParaFormulario}
                planPreventivo={
                  orden.planMantenimiento?.tipo === "POR_CONTADOR"
                    ? { unidadContador: orden.equipo.unidadContador, contadorActual: orden.equipo.contadorActual.toNumber() }
                    : null
                }
              />
            </div>
          </section>
        )}

        {orden.estado === "EN_PROCESO" && (
          <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
              Completar orden
            </h2>
            <CompletarFormulario accion={completarOrdenMantenimiento.bind(null, id)} insumos={insumosParaFormulario} />
          </section>
        )}
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
