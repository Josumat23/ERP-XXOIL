import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";

export default async function CuentasPorPagarPage() {
  const cuentas = await prisma.cuentaPorPagar.findMany({
    include: { proveedor: true, ordenCompra: true },
    orderBy: { fechaEmision: "desc" },
  });

  const hoy = new Date();
  const totalPorPagar = cuentas.reduce((acc, c) => acc + c.saldo.toNumber(), 0);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Cuentas por pagar
      </h1>
      <p className="text-neutral-500 mt-1">
        Deudas con proveedores generadas por las recepciones de compras. Total pendiente:{" "}
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
          {formatMoneda(totalPorPagar)}
        </span>
      </p>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Proveedor</th>
            <th>Orden</th>
            <th>Vencimiento</th>
            <th className="text-right">Total</th>
            <th className="text-right">Saldo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => {
            const vencida =
              c.estado === "PENDIENTE" && c.fechaVencimiento !== null && c.fechaVencimiento < hoy;
            return (
              <tr key={c.id}>
                <td className="font-mono text-xs">{c.numeroDocumento}</td>
                <td>{c.proveedor.razonSocial}</td>
                <td className="font-mono text-xs">
                  {c.ordenCompra ? (
                    <Link
                      href={`/logistica/ordenes-compra/${c.ordenCompra.id}`}
                      className="hover:underline"
                    >
                      {c.ordenCompra.numero}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className={`text-xs whitespace-nowrap ${
                    vencida ? "text-red-600 dark:text-red-400 font-medium" : "text-neutral-500"
                  }`}
                >
                  {c.fechaVencimiento
                    ? new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(c.fechaVencimiento)
                    : "Contado"}
                  {vencida && " (vencida)"}
                </td>
                <td className="text-right">{formatMoneda(c.total)}</td>
                <td className="text-right">{formatMoneda(c.saldo)}</td>
                <td>
                  <span
                    className={`insignia ${
                      c.estado === "PAGADA"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {c.estado === "PAGADA" ? "Pagada" : "Pendiente"}
                  </span>
                </td>
                <td className="text-right">
                  <Link
                    href={`/finanzas/cuentas-por-pagar/${c.id}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Ver / pagar
                  </Link>
                </td>
              </tr>
            );
          })}
          {cuentas.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay cuentas por pagar. Se generan al recibir órdenes de compra.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
