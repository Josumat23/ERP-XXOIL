import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";

const COLOR_ESTADO: Record<string, string> = {
  EN_PROCESO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  PENDIENTE_CALIDAD: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function LotesPage() {
  const lotes = await prisma.loteGranel.findMany({
    include: { formula: { include: { producto: true } } },
    orderBy: { fechaInicio: "desc" },
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Órdenes de producción
          </h1>
          <p className="text-neutral-500 mt-1">
            Primera etapa de producción: cocción a granel según fórmula, con registro de merma.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
          <Link href="/produccion/lotes/nuevo" className="boton-primario">
            Nueva orden
          </Link>
        </div>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>N.° de orden</th>
            <th>Producto / Fórmula</th>
            <th className="text-right">Kg objetivo</th>
            <th className="text-right">Kg producidos</th>
            <th className="text-right">Merma</th>
            <th className="text-right">Granel disponible</th>
            <th>Estado</th>
            <th></th>
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
    </div>
  );
}
