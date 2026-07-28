import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { alternarActivoEquipo } from "./actions";

export default async function EquiposPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; almacenId?: string; estado?: string }>;
}) {
  const { q, almacenId, estado } = await searchParams;

  const almacenes = await prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  const equipos = await prisma.equipo.findMany({
    where: {
      ...(almacenId ? { almacenId } : {}),
      ...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
      ...(q ? { OR: [{ nombre: { contains: q } }, { codigo: { contains: q } }] } : {}),
    },
    include: {
      almacen: true,
      activoFijo: true,
      ordenesMantenimiento: {
        where: { estado: { in: ["PROGRAMADA", "EN_PROCESO"] } },
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Equipos
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Maquinaria y equipo de planta sujeto a mantenimiento.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/produccion/mantenimiento" className="boton-secundario">
            Órdenes de mantenimiento
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Nombre o código...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Almacén / planta</span>
          <select name="almacenId" defaultValue={almacenId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/produccion/equipos/nuevo"
        nuevoTexto="Nuevo equipo"
        registros={equipos.map((e) => ({
          id: e.id,
          href: `/produccion/equipos/${e.id}`,
          primario: e.nombre,
          secundario: e.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Almacén / planta</th>
            <th>Activo fijo</th>
            <th>Mantenimiento pendiente</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((e) => (
            <tr key={e.id}>
              <td className="font-mono text-xs">{e.codigo}</td>
              <td>
                <Link href={`/produccion/equipos/${e.id}`} className="hover:underline">
                  {e.nombre}
                </Link>
              </td>
              <td>{e.almacen.nombre}</td>
              <td className="font-mono text-xs">{e.activoFijo?.codigo ?? "—"}</td>
              <td>
                {e.ordenesMantenimiento.length > 0 ? (
                  <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                    {e.ordenesMantenimiento.length} orden(es)
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <span
                  className={`insignia ${
                    e.activo
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {e.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="text-right">
                <form
                  action={async () => {
                    "use server";
                    await alternarActivoEquipo(e.id, !e.activo);
                  }}
                >
                  <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                    {e.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {equipos.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                No hay equipos registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
