import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ETIQUETA_ESTADO_HR } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

export default async function HojasRutaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendedorId?: string; estado?: string }>;
}) {
  const { q, vendedorId, estado } = await searchParams;
  const filtroEstado = estado === "PLANIFICADA" || estado === "COMPLETADA" ? estado : undefined;

  const vendedores = await prisma.vendedor.findMany({ orderBy: { nombre: "asc" } });

  const hojas = await prisma.hojaRuta.findMany({
    where: {
      ...(vendedorId ? { vendedorId } : {}),
      ...(filtroEstado ? { estado: filtroEstado } : {}),
      ...(q ? { numero: { contains: q } } : {}),
    },
    include: { vendedor: true, _count: { select: { visitas: true } } },
    orderBy: { fecha: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Hojas de ruta
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Planificación diaria de visitas por vendedor, con registro de resultados.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Número...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Vendedor</span>
          <select name="vendedorId" defaultValue={vendedorId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={filtroEstado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="PLANIFICADA">{ETIQUETA_ESTADO_HR.PLANIFICADA}</option>
            <option value="COMPLETADA">{ETIQUETA_ESTADO_HR.COMPLETADA}</option>
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/comercial/hojas-ruta/nueva"
        nuevoTexto="Nueva hoja de ruta"
        registros={hojas.map((h) => ({
          id: h.id,
          href: `/comercial/hojas-ruta/${h.id}`,
          primario: h.numero,
          secundario: h.vendedor.nombre,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Vendedor</th>
            <th>Fecha</th>
            <th>Visitas</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {hojas.map((h) => (
            <tr key={h.id}>
              <td className="font-mono text-xs">{h.numero}</td>
              <td>{h.vendedor.nombre}</td>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(h.fecha)}
              </td>
              <td>{h._count.visitas}</td>
              <td>
                <span
                  className={`insignia ${
                    h.estado === "COMPLETADA"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                  }`}
                >
                  {ETIQUETA_ESTADO_HR[h.estado]}
                </span>
              </td>
              <td className="text-right">
                <Link
                  href={`/comercial/hojas-ruta/${h.id}`}
                  className="text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  Ver / imprimir
                </Link>
              </td>
            </tr>
          ))}
          {hojas.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                No hay hojas de ruta registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
