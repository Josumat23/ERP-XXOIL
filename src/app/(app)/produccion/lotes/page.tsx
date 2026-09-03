import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const COLOR_ESTADO: Record<string, string> = {
  PLANIFICADO: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  EN_PROCESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  PENDIENTE_CALIDAD: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};
const ESTADOS = Object.keys(ETIQUETA_ESTADO_LOTE) as (keyof typeof ETIQUETA_ESTADO_LOTE)[];

export default async function LotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { q, estado } = await searchParams;
  const filtroEstado = ESTADOS.find((e) => e === estado);

  const lotes = await prisma.loteGranel.findMany({
    where: {
      ...(filtroEstado ? { estado: filtroEstado } : {}),
      ...(q
        ? { OR: [{ codigo: { contains: q } }, { formula: { producto: { nombre: { contains: q } } } }] }
        : {}),
    },
    include: { formula: { include: { producto: true } } },
    orderBy: { fechaInicio: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Órdenes de producción
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Primera etapa de producción: cocción a granel según fórmula, con registro de merma.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Código o producto...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={filtroEstado ?? ""} className="campo-input">
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_LOTE[e]}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/produccion/lotes/nuevo"
        nuevoTexto="Nueva orden"
        registros={lotes.map((l) => ({
          id: l.id,
          href: `/produccion/lotes/${l.id}`,
          primario: l.codigo,
          secundario: l.formula.producto.nombre,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>N.° de orden</th>
            <th>Producto / Fórmula</th>
            <th className="text-right">Kg objetivo</th>
            <th className="text-right">Kg producidos</th>
            <th className="text-right">Merma</th>
            <th className="text-right">Granel disponible</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.id}>
              <td className="font-mono text-xs">{l.codigo}</td>
              <td>
                {l.formula.producto.nombre}{" "}
                <span className="text-xs text-neutral-400">v{l.formula.version}</span>
              </td>
              <td className="text-right">{formatNumero(l.kgObjetivo, 2)}</td>
              <td className="text-right">
                {l.estado === "EN_PROCESO" ? "—" : formatNumero(l.kgProducidos, 2)}
              </td>
              <td className="text-right">
                {l.estado === "EN_PROCESO" ? "—" : formatNumero(l.mermaKg, 2)}
              </td>
              <td className="text-right">{formatNumero(l.kgDisponibles, 2)}</td>
              <td>
                <span className={`insignia ${COLOR_ESTADO[l.estado]}`}>
                  {ETIQUETA_ESTADO_LOTE[l.estado]}
                </span>
              </td>
              <td className="text-right">
                <Link
                  href={`/produccion/lotes/${l.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
          {lotes.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay órdenes de producción registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
