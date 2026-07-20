import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_MEDIO_PAGO } from "@/lib/etiquetas";
import PagoFormulario from "./PagoFormulario";

export default async function DetalleCuentaPorPagarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cuenta = await prisma.cuentaPorPagar.findUnique({
    where: { id },
    include: {
      proveedor: true,
      ordenCompra: true,
      pagos: { orderBy: { fecha: "asc" } },
    },
  });
  if (!cuenta) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/finanzas/cuentas-por-pagar" className="text-sm text-neutral-500 hover:underline">
        ← Volver a cuentas por pagar
      </Link>

      <div className="flex items-center gap-3 mt-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
          {cuenta.numeroDocumento}
        </h1>
        <span
          className={`insignia ${
            cuenta.estado === "PAGADA"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {cuenta.estado === "PAGADA" ? "Pagada" : "Pendiente"}
        </span>
      </div>
      <p className="text-neutral-500 mt-1">
        {cuenta.proveedor.razonSocial}
        {cuenta.ordenCompra && (
          <>
            {" "}
            · Orden{" "}
            <Link
              href={`/logistica/ordenes-compra/${cuenta.ordenCompra.id}`}
              className="font-mono text-sm hover:underline"
            >
              {cuenta.ordenCompra.numero}
            </Link>
          </>
        )}{" "}
        · Emitida el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(cuenta.fechaEmision)}
        {cuenta.fechaVencimiento &&
          ` · Vence el ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(cuenta.fechaVencimiento)}`}
      </p>

      <div className="grid grid-cols-2 gap-4 mt-6 max-w-md">
        <Dato etiqueta="Total" valor={formatMoneda(cuenta.total)} />
        <Dato etiqueta="Saldo por pagar" valor={formatMoneda(cuenta.saldo)} />
      </div>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Pagos realizados</h2>
        {cuenta.pagos.length > 0 ? (
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Medio</th>
                <th>Referencia</th>
                <th>Registrado por</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {cuenta.pagos.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                      p.fecha
                    )}
                  </td>
                  <td>{ETIQUETA_MEDIO_PAGO[p.medioPago]}</td>
                  <td className="text-sm text-neutral-500">{p.referencia ?? "—"}</td>
                  <td className="text-sm">{p.usuarioNombre}</td>
                  <td className="text-right">{formatMoneda(p.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-neutral-500 mt-2">Sin pagos registrados.</p>
        )}

        {cuenta.saldo.toNumber() > 0 && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-4">
            <PagoFormulario cuentaId={cuenta.id} saldo={cuenta.saldo.toNumber()} />
          </div>
        )}
      </section>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
