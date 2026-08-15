import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import { costoRealProyecto } from "@/lib/proyectos";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const ETIQUETA_ESTADO: Record<string, string> = {
  PLANIFICADO: "Planificado",
  EN_PROGRESO: "En progreso",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

const CLASE_ESTADO: Record<string, string> = {
  PLANIFICADO: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  EN_PROGRESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  CERRADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "proyectos", "ver"))) redirect("/");

  const { q, estado } = await searchParams;

  const proyectos = await prisma.proyecto.findMany({
    where: {
      ...(estado ? { estado: estado as "PLANIFICADO" | "EN_PROGRESO" | "CERRADO" | "CANCELADO" } : {}),
      ...(q ? { nombre: { contains: q } } : {}),
    },
    include: { centroCosto: true, responsable: true },
    orderBy: { creadoEn: "desc" },
  });

  const costos = await Promise.all(proyectos.map((p) => costoRealProyecto(prisma, p.id)));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Proyectos
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Obras de capital propio (ampliación de planta, nueva línea): WBS, red de actividades con
            ruta crítica y costos reales, hasta capitalizar como activo fijo.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Nombre del proyecto...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/proyectos/nuevo"
        nuevoTexto="Nuevo proyecto"
        registros={proyectos.map((p) => ({
          id: p.id,
          href: `/proyectos/${p.id}`,
          primario: p.codigo,
          secundario: p.nombre,
        }))}
      >
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Responsable</th>
              <th className="text-right">Presupuesto</th>
              <th className="text-right">Costo real</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map((p, idx) => {
              const presupuesto = p.presupuestoTotal.toNumber();
              const costoReal = costos[idx];
              const excede = costoReal > presupuesto;
              return (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.codigo}</td>
                  <td className="font-medium">{p.nombre}</td>
                  <td>{p.responsable ? `${p.responsable.nombres} ${p.responsable.apellidos}` : "—"}</td>
                  <td className="text-right">{formatMoneda(presupuesto)}</td>
                  <td className={`text-right ${excede ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                    {formatMoneda(costoReal)}
                  </td>
                  <td>
                    <span className={`insignia ${CLASE_ESTADO[p.estado]}`}>{ETIQUETA_ESTADO[p.estado]}</span>
                  </td>
                  <td className="text-right">
                    <Link href={`/proyectos/${p.id}`} className="text-neutral-600 dark:text-neutral-400 hover:underline">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              );
            })}
            {proyectos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-neutral-500 py-6">
                  No hay proyectos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PanelMaestroDetalle>
    </div>
  );
}
