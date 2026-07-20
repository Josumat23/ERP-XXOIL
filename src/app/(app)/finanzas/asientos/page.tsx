import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

const ETIQUETA_ORIGEN: Record<string, string> = {
  MANUAL: "Manual",
  VENTA: "Venta",
  COBRO: "Cobro",
  NOTA_CREDITO: "Nota de crédito",
  ANULACION_VENTA: "Anulación de venta",
  COMPRA: "Compra",
  PAGO_PROVEEDOR: "Pago a proveedor",
  REVERSO: "Reverso",
};

export default async function AsientosPage() {
  const asientos = await prisma.asientoContable.findMany({
    include: { detalles: true },
    orderBy: { numero: "desc" },
    take: 100,
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Asientos contables
        </h1>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
          <Link href="/finanzas/asientos/nuevo" className="boton-primario">
            Asiento manual
          </Link>
        </div>
      </div>
      <p className="text-neutral-500 mt-1 no-imprimir">
        Libro diario. Los asientos automáticos nacen de las transacciones (ventas, cobros, compras,
        pagos); los asientos nunca se editan: se corrigen con un reverso.
      </p>

      <table className="tabla tabla-densa mt-6">
        <thead>
          <tr>
            <th>Número</th>
            <th>Fecha</th>
            <th>Origen</th>
            <th>Glosa</th>
            <th className="text-right">Importe</th>
            <th>Registrado por</th>
            <th className="no-imprimir"></th>
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
                <td>{ETIQUETA_ORIGEN[a.origen]}</td>
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
    </div>
  );
}
