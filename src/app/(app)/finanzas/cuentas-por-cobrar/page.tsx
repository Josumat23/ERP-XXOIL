import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import BarraFiltro from "@/components/BarraFiltro";

const MS_POR_DIA = 1000 * 60 * 60 * 24;

function tramoVencimiento(diasVencidos: number): { etiqueta: string; color: string } {
  if (diasVencidos <= 0) {
    return { etiqueta: "Al día", color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" };
  }
  if (diasVencidos <= 15) {
    return { etiqueta: "1-15 días", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" };
  }
  if (diasVencidos <= 30) {
    return { etiqueta: "16-30 días", color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400" };
  }
  return { etiqueta: "+30 días", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" };
}

export default async function CuentasPorCobrarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const { q } = await searchParams;

  const facturas = await prisma.factura.findMany({
    where: {
      estado: "PENDIENTE",
      ...(q
        ? { OR: [{ numero: { contains: q } }, { cliente: { razonSocial: { contains: q } } }] }
        : {}),
    },
    include: { cliente: true, vendedor: true },
    orderBy: { fechaVencimiento: "asc" },
  });

  const hoy = new Date();
  const totalPorCobrar = facturas.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const totalVencido = facturas.reduce((acc, f) => {
    const dias = Math.floor((hoy.getTime() - f.fechaVencimiento.getTime()) / MS_POR_DIA);
    return dias > 0 ? acc + f.saldo.toNumber() : acc;
  }, 0);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Cuentas por cobrar
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Facturas emitidas a clientes con saldo pendiente de cobro, ordenadas por antigüedad de
        vencimiento.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 max-w-2xl">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Total por cobrar</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatMoneda(totalPorCobrar)}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Vencido</p>
          <p className="text-xl font-semibold text-red-600 dark:text-red-400 mt-0.5">
            {formatMoneda(totalVencido)}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Facturas pendientes</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {facturas.length}
          </p>
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Número o cliente..." />

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Vencimiento</th>
            <th>Antigüedad</th>
            <th className="text-right">Total</th>
            <th className="text-right">Saldo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((f) => {
            const dias = Math.floor((hoy.getTime() - f.fechaVencimiento.getTime()) / MS_POR_DIA);
            const tramo = tramoVencimiento(dias);
            return (
              <tr key={f.id}>
                <td className="font-mono text-xs">{f.numero}</td>
                <td>{f.cliente.razonSocial}</td>
                <td>{f.vendedor.nombre}</td>
                <td
                  className={`text-xs whitespace-nowrap ${
                    dias > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-neutral-500"
                  }`}
                >
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(f.fechaVencimiento)}
                </td>
                <td>
                  <span className={`insignia ${tramo.color}`}>{tramo.etiqueta}</span>
                </td>
                <td className="text-right">{formatMoneda(f.total)}</td>
                <td className="text-right font-medium">{formatMoneda(f.saldo)}</td>
                <td className="text-right">
                  <Link
                    href={`/comercial/facturas/${f.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Ver / cobrar
                  </Link>
                </td>
              </tr>
            );
          })}
          {facturas.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay cuentas por cobrar pendientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
