import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_ESTADO_PEDIDO } from "@/lib/etiquetas";
import { anularPedido } from "../actions";
import FacturarFormulario from "./FacturarFormulario";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  FACTURADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADO: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: true,
      factura: true,
      detalles: { include: { presentacion: { include: { producto: true } } } },
    },
  });
  if (!pedido) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/comercial/pedidos" className="text-sm text-neutral-500 hover:underline">
        ← Volver a pedidos
      </Link>

      <div className="flex items-center gap-3 mt-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Pedido {pedido.numero}
        </h1>
        <span className={`insignia ${COLOR_ESTADO[pedido.estado]}`}>
          {ETIQUETA_ESTADO_PEDIDO[pedido.estado]}
        </span>
      </div>
      <p className="text-neutral-500 mt-1">
        {pedido.cliente.razonSocial} · Vendedor: {pedido.vendedor.nombre} · Registrado por{" "}
        {pedido.usuarioNombre} el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
          pedido.fecha
        )}
      </p>
      {pedido.notas && <p className="text-sm text-neutral-500 mt-1">Notas: {pedido.notas}</p>}

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Presentación</th>
            <th className="text-right">Cantidad</th>
            <th className="text-right">Precio unit.</th>
            <th className="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {pedido.detalles.map((d) => (
            <tr key={d.id}>
              <td>
                {d.presentacion.producto.nombre} — {d.presentacion.nombre}
                <span className="block text-xs text-neutral-400 font-mono">
                  {d.presentacion.sku}
                </span>
              </td>
              <td className="text-right">{d.cantidad}</td>
              <td className="text-right">{formatMoneda(d.precioUnitario)}</td>
              <td className="text-right">{formatMoneda(d.subtotal)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="text-right font-semibold">
              Total
            </td>
            <td className="text-right font-semibold">{formatMoneda(pedido.total)}</td>
          </tr>
        </tbody>
      </table>

      {pedido.estado === "PENDIENTE" && (
        <>
          <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
              Facturar este pedido
            </h2>
            <FacturarFormulario
              pedidoId={pedido.id}
              condicionDefecto={pedido.cliente.condicionPagoDefecto}
            />
          </section>

          <form
            className="mt-4"
            action={async () => {
              "use server";
              await anularPedido(pedido.id);
            }}
          >
            <button type="submit" className="text-sm text-red-600 dark:text-red-400 hover:underline">
              Anular pedido
            </button>
          </form>
        </>
      )}

      {pedido.factura && (
        <p className="mt-6 text-sm">
          Factura asociada:{" "}
          <Link
            href={`/comercial/facturas/${pedido.factura.id}`}
            className="font-mono hover:underline"
          >
            {pedido.factura.numero}
          </Link>
        </p>
      )}
    </div>
  );
}
