import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatFecha, formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { EstadoOrdenMantenimiento } from "@/generated/prisma/client";

const ETIQUETA_ESTADO: Record<EstadoOrdenMantenimiento, string> = {
  PROGRAMADA: "Programada",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};
const ESTADOS = Object.values(EstadoOrdenMantenimiento);

const COLOR_ESTADO: Record<EstadoOrdenMantenimiento, string> = {
  PROGRAMADA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  EN_PROCESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  COMPLETADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function MantenimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string }>;
}) {
  const { q, tipo, estado } = await searchParams;
  const filtroTipo = tipo === "PREVENTIVO" || tipo === "CORRECTIVO" ? tipo : undefined;
  const filtroEstado = ESTADOS.find((e) => e === estado);

  const [ordenes, todasOrdenes] = await Promise.all([
    prisma.ordenMantenimiento.findMany({
      where: {
        ...(filtroTipo ? { tipo: filtroTipo } : {}),
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(q
          ? { OR: [{ codigo: { contains: q } }, { equipo: { nombre: { contains: q } } }] }
          : {}),
      },
      include: { equipo: { include: { almacen: true } } },
      orderBy: { fechaProgramada: "desc" },
    }),
    prisma.ordenMantenimiento.findMany(),
  ]);

  const pendientes = todasOrdenes.filter((o) => o.estado === "PROGRAMADA" || o.estado === "EN_PROCESO");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Mantenimiento de planta
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Órdenes de mantenimiento preventivo y correctivo por equipo.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/produccion/equipos" className="boton-secundario">
            Equipos
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Dato etiqueta="Órdenes pendientes / en proceso" valor={String(pendientes.length)} />
        <Dato
          etiqueta="Costo acumulado (completadas)"
          valor={formatMoneda(
            todasOrdenes
              .filter((o) => o.estado === "COMPLETADA")
              .reduce((acc, o) => acc + o.costoManoObra.toNumber() + o.costoRepuestos.toNumber(), 0)
          )}
        />
      </div>

      <BarraFiltro q={q} placeholder="Código o equipo...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
          <select name="tipo" defaultValue={filtroTipo ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="PREVENTIVO">Preventivo</option>
            <option value="CORRECTIVO">Correctivo</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={filtroEstado ?? ""} className="campo-input">
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/produccion/mantenimiento/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/produccion/mantenimiento/${o.id}`,
          primario: o.equipo.nombre,
          secundario: o.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Equipo</th>
            <th>Almacén / planta</th>
            <th>Tipo</th>
            <th>Programada</th>
            <th>Estado</th>
            <th className="text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id}>
              <td className="font-mono text-xs">
                <Link href={`/produccion/mantenimiento/${o.id}`} className="hover:underline">
                  {o.codigo}
                </Link>
              </td>
              <td>{o.equipo.nombre}</td>
              <td>{o.equipo.almacen.nombre}</td>
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
          {ordenes.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                No hay órdenes de mantenimiento registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
