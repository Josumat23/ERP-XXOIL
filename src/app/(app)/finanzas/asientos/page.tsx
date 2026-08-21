import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { ETIQUETA_ORIGEN_ASIENTO } from "@/lib/etiquetas";
import { EMPRESA_CONTABLE_PRINCIPAL_ID } from "@/lib/asientosManuales";

const ORIGENES = Object.keys(ETIQUETA_ORIGEN_ASIENTO) as (keyof typeof ETIQUETA_ORIGEN_ASIENTO)[];

export default async function AsientosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; origen?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const { q, origen } = await searchParams;
  const filtroOrigen = ORIGENES.find((o) => o === origen);

  const asientos = await prisma.asientoContable.findMany({
    where: {
      empresaId: EMPRESA_CONTABLE_PRINCIPAL_ID,
      ...(filtroOrigen ? { origen: filtroOrigen } : {}),
      ...(q ? { OR: [{ numero: { contains: q } }, { glosa: { contains: q } }] } : {}),
    },
    include: { detalles: true },
    orderBy: { numero: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Asientos contables
        </h1>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>
      <p className="text-sm mb-4 no-imprimir" style={{ color: "var(--epicor-texto-tenue)" }}>
        Libro diario. Los asientos automáticos nacen de las transacciones (ventas, cobros, compras,
        pagos); los asientos nunca se editan: se corrigen con un reverso.
      </p>

      <BarraFiltro q={q} placeholder="Número o glosa...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Origen</span>
          <select name="origen" defaultValue={filtroOrigen ?? ""} className="campo-input">
            <option value="">Todos</option>
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORIGEN_ASIENTO[o]}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/asientos/nuevo"
        nuevoTexto="Asiento manual"
        registros={asientos.map((a) => ({
          id: a.id,
          href: `/finanzas/asientos/${a.id}`,
          primario: a.numero,
          secundario: ETIQUETA_ORIGEN_ASIENTO[a.origen],
        }))}
      >
      <table className="tabla tabla-densa">
        <thead>
          <tr>
            <th>Número</th>
            <th>Fecha</th>
            <th>Origen</th>
            <th>Glosa</th>
            <th className="text-right">Importe</th>
            <th>Registrado por</th>
            <th className="no-imprimir">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {asientos.map((a) => {
            const importe = a.detalles.reduce((acc, d) => acc + d.debe.toNumber(), 0);
            return (
              <tr key={a.id}>
                <td className="font-mono text-xs">
                  {a.numero}
                  {a.reversadoPor && (
                    <span className="text-red-500 ml-1" title={`Reversado por ${a.reversadoPor}`}>
                      ⤾
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(a.fecha)}
                </td>
                <td>{ETIQUETA_ORIGEN_ASIENTO[a.origen]}</td>
                <td className="max-w-72 truncate">{a.glosa}</td>
                <td className="text-right">{formatMoneda(importe)}</td>
                <td>{a.usuarioNombre}</td>
                <td className="text-right no-imprimir">
                  <Link
                    href={`/finanzas/asientos/${a.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
          {asientos.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-neutral-500 py-6">
                Sin asientos registrados. Se generan solos al facturar, cobrar, comprar y pagar (con
                los controles contables configurados), o manualmente desde aquí.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
