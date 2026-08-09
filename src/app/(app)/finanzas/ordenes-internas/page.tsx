import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTA: "Abierta",
  LIQUIDADA: "Liquidada",
  ANULADA: "Anulada",
};

const CLASE_ESTADO: Record<string, string> = {
  ABIERTA: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  LIQUIDADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function OrdenesInternasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;

  const ordenes = await prisma.ordenInterna.findMany({
    where: {
      ...(estado ? { estado: estado as "ABIERTA" | "LIQUIDADA" | "ANULADA" } : {}),
      ...(q ? { descripcion: { contains: q } } : {}),
    },
    include: { centroCosto: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Órdenes internas
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Objeto de costeo temporal para un propósito puntual (campaña, evento, proyecto corto)
            que no justifica un centro de costo permanente. Se liquida contra un centro de costo al
            terminar.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Descripción...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todas</option>
            <option value="ABIERTA">Abiertas</option>
            <option value="LIQUIDADA">Liquidadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/ordenes-internas/nueva"
        nuevoTexto="Nueva orden interna"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/finanzas/ordenes-internas/${o.id}`,
          primario: o.codigo,
          secundario: o.descripcion,
        }))}
      >
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Centro de costo</th>
              <th className="text-right">Presupuesto</th>
              <th className="text-right">Acumulado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs">{o.codigo}</td>
                <td className="font-medium">{o.descripcion}</td>
                <td>{o.centroCosto?.nombre ?? "—"}</td>
                <td className="text-right">
                  {o.presupuesto ? formatMoneda(o.presupuesto.toNumber()) : "—"}
                </td>
                <td className="text-right">{formatMoneda(o.totalAcumulado.toNumber())}</td>
                <td>
                  <span className={`insignia ${CLASE_ESTADO[o.estado]}`}>
                    {ETIQUETA_ESTADO[o.estado]}
                  </span>
                </td>
                <td className="text-right">
                  <Link
                    href={`/finanzas/ordenes-internas/${o.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {ordenes.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-neutral-500 py-6">
                  No hay órdenes internas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PanelMaestroDetalle>
    </div>
  );
}
