import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  VENCIDA: "Vencida",
  CONVERTIDA: "Convertida a pedido",
};

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  ACEPTADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  VENCIDA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  CONVERTIDA: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
};

const ESTADOS = Object.keys(ETIQUETA_ESTADO) as (keyof typeof ETIQUETA_ESTADO)[];

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const filtroEstado = ESTADOS.find((e) => e === estado);

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      ...(filtroEstado ? { estado: filtroEstado } : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q } },
              { cliente: { razonSocial: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { cliente: true, vendedor: true },
    orderBy: { fecha: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Cotizaciones
          </h1>
          <p className="text-sm no-imprimir" style={{ color: "var(--epicor-texto-tenue)" }}>
            Etapa opcional antes del pedido — al aceptarse, se convierte en un pedido real.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/comercial/pipeline" className="boton-secundario">
            Embudo de ventas
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Número o cliente...">
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
        nuevoHref="/comercial/cotizaciones/nuevo"
        nuevoTexto="Nueva cotización"
        registros={cotizaciones.map((c) => ({
          id: c.id,
          href: `/comercial/cotizaciones/${c.id}`,
          primario: c.numero,
          secundario: c.cliente.razonSocial,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Válida hasta</th>
            <th className="text-right">Total</th>
            <th className="text-right">Prob.</th>
            <th className="text-right">Valor ponderado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {cotizaciones.map((c) => (
            <tr key={c.id}>
              <td className="font-mono text-xs">
                <Link href={`/comercial/cotizaciones/${c.id}`} className="hover:underline">
                  {c.numero}
                </Link>
              </td>
              <td>{c.cliente.razonSocial}</td>
              <td className="text-sm">{c.vendedor.nombre}</td>
              <td className="text-sm text-neutral-500">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(c.validaHasta)}
              </td>
              <td className="text-right">{formatMoneda(c.total)}</td>
              <td className="text-right text-sm text-neutral-500">{c.probabilidad}%</td>
              <td className="text-right text-sm text-neutral-500">
                {formatMoneda(c.total.toNumber() * (c.probabilidad / 100))}
              </td>
              <td>
                <span className={`insignia ${COLOR_ESTADO[c.estado]}`}>{ETIQUETA_ESTADO[c.estado]}</span>
              </td>
            </tr>
          ))}
          {cotizaciones.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay cotizaciones registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
