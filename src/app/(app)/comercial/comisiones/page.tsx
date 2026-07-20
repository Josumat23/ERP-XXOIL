import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

export default async function ComisionesPage() {
  const comisiones = await prisma.comision.findMany({
    include: { vendedor: true, factura: true },
    orderBy: { creadoEn: "desc" },
  });

  // Neto por vendedor (generadas menos reversiones, solo pendientes)
  const porVendedor = new Map<string, { nombre: string; neto: number }>();
  for (const c of comisiones) {
    if (c.estado !== "PENDIENTE") continue;
    const actual = porVendedor.get(c.vendedorId) ?? { nombre: c.vendedor.nombre, neto: 0 };
    actual.neto += c.monto.toNumber();
    porVendedor.set(c.vendedorId, actual);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Comisiones</h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Se generan al facturar y se revierten con anulaciones o notas de crédito. Los registros no se
        editan: cada reversión es un movimiento nuevo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {[...porVendedor.entries()].map(([id, v]) => (
          <div key={id} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
            <p className="text-sm text-neutral-500">{v.nombre}</p>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
              {formatMoneda(v.neto)}
            </p>
            <p className="text-xs text-neutral-400">pendiente de pago</p>
          </div>
        ))}
        {porVendedor.size === 0 && (
          <p className="text-neutral-500 col-span-3">No hay comisiones pendientes.</p>
        )}
      </div>

      <table className="tabla mt-8">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Vendedor</th>
            <th>Factura</th>
            <th>Tipo</th>
            <th className="text-right">Tasa</th>
            <th className="text-right">Monto</th>
            <th>Estado</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {comisiones.map((c) => (
            <tr key={c.id}>
              <td className="text-xs text-neutral-500 whitespace-nowrap">
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(c.creadoEn)}
              </td>
              <td>{c.vendedor.nombre}</td>
              <td className="font-mono text-xs">
                <Link href={`/comercial/facturas/${c.facturaId}`} className="hover:underline">
                  {c.factura.numero}
                </Link>
              </td>
              <td>
                <span
                  className={`insignia ${
                    c.tipo === "GENERADA"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {c.tipo === "GENERADA" ? "Generada" : "Reversión"}
                </span>
              </td>
              <td className="text-right">{c.tasa.toNumber()}%</td>
              <td
                className={`text-right font-medium ${
                  c.monto.toNumber() < 0 ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {formatMoneda(c.monto)}
              </td>
              <td>
                <span
                  className={`insignia ${
                    c.estado === "PAGADA"
                      ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                  }`}
                >
                  {c.estado === "PAGADA" ? "Pagada" : "Pendiente"}
                </span>
              </td>
              <td className="text-sm text-neutral-500 max-w-56">{c.motivo ?? "—"}</td>
            </tr>
          ))}
          {comisiones.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay comisiones registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
