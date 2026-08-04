import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import ReclamoFormulario from "./ReclamoFormulario";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  CERRADO: "Cerrado",
};

export default async function ReclamosClientePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const filtroEstado = Object.keys(ETIQUETA_ESTADO).find((e) => e === estado);

  const [reclamos, clientes, facturas, causas] = await Promise.all([
    prisma.reclamoCliente.findMany({
      where: {
        ...(filtroEstado ? { estado: filtroEstado as "ABIERTO" | "EN_PROCESO" | "CERRADO" } : {}),
        ...(q
          ? { OR: [{ numero: { contains: q } }, { cliente: { razonSocial: { contains: q } } }] }
          : {}),
      },
      include: { cliente: true, causa: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.factura.findMany({
      where: { estado: { not: "ANULADA" } },
      orderBy: { fechaEmision: "desc" },
      take: 100,
    }),
    prisma.causaCalidad.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/produccion/calidad" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
            ← Volver a control de calidad
          </Link>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
            Reclamos de cliente
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Notificación formal de calidad recibida después de la venta, con seguimiento hasta el
            cierre.
          </p>
        </div>
        <BotonImprimir />
      </div>

      <BarraFiltro q={q} placeholder="Número o cliente...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={filtroEstado ?? ""} className="campo-input">
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
        registros={reclamos.map((r) => ({
          id: r.id,
          href: `/produccion/calidad/reclamos/${r.id}`,
          primario: r.numero,
          secundario: r.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <ReclamoFormulario
          clientes={clientes.map((c) => ({ id: c.id, etiqueta: c.razonSocial }))}
          facturas={facturas.map((f) => ({ id: f.id, numero: f.numero, clienteId: f.clienteId }))}
          causas={causas.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
        />

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Causa</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {reclamos.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">
                  <Link href={`/produccion/calidad/reclamos/${r.id}`} className="hover:underline">
                    {r.numero}
                  </Link>
                </td>
                <td>{r.cliente.razonSocial}</td>
                <td className="text-sm text-neutral-500">{r.causa?.nombre ?? "—"}</td>
                <td>
                  <span
                    className={`insignia ${
                      r.estado === "CERRADO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : r.estado === "EN_PROCESO"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {ETIQUETA_ESTADO[r.estado]}
                  </span>
                </td>
                <td className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(r.fecha)}
                </td>
              </tr>
            ))}
            {reclamos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-neutral-500 py-6">
                  No hay reclamos registrados todavía.
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
