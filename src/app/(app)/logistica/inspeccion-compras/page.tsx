import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNumero } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { ResultadoInspeccion } from "@/generated/prisma/client";

const ETIQUETA_RESULTADO: Record<ResultadoInspeccion, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

const COLOR_RESULTADO: Record<ResultadoInspeccion, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

const RESULTADOS = Object.values(ResultadoInspeccion);

export default async function InspeccionesCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resultado?: string }>;
}) {
  const { q, resultado } = await searchParams;
  const filtroResultado = RESULTADOS.find((r) => r === resultado);

  const inspecciones = await prisma.inspeccionCompra.findMany({
    where: {
      ...(filtroResultado ? { resultado: filtroResultado } : {}),
      ...(q ? { recepcionDetalle: { insumo: { nombre: { contains: q } } } } : {}),
    },
    include: {
      recepcionDetalle: {
        include: {
          insumo: true,
          recepcion: { include: { ordenCompra: { include: { proveedor: true } } } },
        },
      },
    },
    orderBy: [{ resultado: "asc" }, { creadoEn: "desc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Inspección de calidad de compras
        </h1>
      </div>

      <PanelMaestroDetalle
        registros={inspecciones.map((i) => ({
          id: i.id,
          href: `/logistica/inspeccion-compras/${i.id}`,
          primario: i.recepcionDetalle.insumo.nombre,
          secundario: `${ETIQUETA_RESULTADO[i.resultado]} · Recepción ${i.recepcionDetalle.recepcion.numero}`,
        }))}
      >
        <div className="max-w-3xl">
          <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
            Recepciones de insumos marcados como &quot;requiere inspección&quot;: no suman stock
            disponible hasta que se aprueban aquí.
          </p>
          <BarraFiltro q={q} placeholder="Insumo...">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Resultado</span>
              <select name="resultado" defaultValue={filtroResultado ?? ""} className="campo-input">
                <option value="">Todos</option>
                {RESULTADOS.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_RESULTADO[r]}
                  </option>
                ))}
              </select>
            </label>
          </BarraFiltro>
          <table className="tabla">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Proveedor</th>
                <th>Recepción</th>
                <th className="text-right">Cantidad</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {inspecciones.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/logistica/inspeccion-compras/${i.id}`} className="hover:underline">
                      {i.recepcionDetalle.insumo.nombre}
                    </Link>
                  </td>
                  <td>{i.recepcionDetalle.recepcion.ordenCompra.proveedor.razonSocial}</td>
                  <td className="font-mono text-xs">{i.recepcionDetalle.recepcion.numero}</td>
                  <td className="text-right">
                    {formatNumero(i.recepcionDetalle.cantidad, 3)} {i.recepcionDetalle.insumo.unidadMedida}
                  </td>
                  <td>
                    <span className={`insignia ${COLOR_RESULTADO[i.resultado]}`}>
                      {ETIQUETA_RESULTADO[i.resultado]}
                    </span>
                  </td>
                </tr>
              ))}
              {inspecciones.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-4">
                    Sin recepciones pendientes de inspección.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}
