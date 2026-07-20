import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import {
  ETIQUETA_ESTADO_FACTURA,
  ETIQUETA_CONDICION_PAGO,
  ETIQUETA_MEDIO_PAGO,
} from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import {
  CobroFormulario,
  NotaCreditoFormulario,
  AnularFacturaFormulario,
} from "./FormulariosFactura";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PAGADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function DetalleFacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: true,
      pedido: { include: { detalles: { include: { presentacion: { include: { producto: true } } } } } },
      cobros: { orderBy: { fecha: "asc" } },
      notasCredito: { orderBy: { fecha: "asc" } },
      comisiones: { orderBy: { creadoEn: "asc" } },
      guias: true,
    },
  });
  if (!factura) notFound();

  const totalNC = factura.notasCredito.reduce((acc, nc) => acc + nc.monto.toNumber(), 0);
  const maximoNC = factura.total.toNumber() - totalNC;
  const puedeOperar = factura.estado !== "ANULADA";
  const sinCobrosNiNC = factura.cobros.length === 0 && factura.notasCredito.length === 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/comercial/facturas" className="text-sm text-neutral-500 hover:underline">
          ← Volver a facturas
        </Link>
        <BotonImprimir />
      </div>

      <div className="flex items-center gap-3 mt-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
          {factura.numero}
        </h1>
        <span className={`insignia ${COLOR_ESTADO[factura.estado]}`}>
          {ETIQUETA_ESTADO_FACTURA[factura.estado]}
        </span>
      </div>
      <p className="text-neutral-500 mt-1">
        {factura.cliente.razonSocial} · Vendedor: {factura.vendedor.nombre} ·{" "}
        {ETIQUETA_CONDICION_PAGO[factura.condicionPago]} · Emitida el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(factura.fechaEmision)} ·
        Vence el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(factura.fechaVencimiento)}
      </p>

      {factura.estado === "ANULADA" && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          Anulada por {factura.anuladaPor} el{" "}
          {factura.anuladaEn &&
            new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
              factura.anuladaEn
            )}
          . Motivo: {factura.motivoAnulacion}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4 mt-6">
        <Dato etiqueta="Total" valor={formatMoneda(factura.total)} />
        <Dato etiqueta="Notas de crédito" valor={formatMoneda(totalNC)} />
        <Dato etiqueta="Saldo por cobrar" valor={formatMoneda(factura.saldo)} />
      </div>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Detalle (pedido {factura.pedido.numero})
        </h2>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Presentación</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Precio unit.</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {factura.pedido.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.presentacion.producto.nombre} — {d.presentacion.nombre}
                </td>
                <td className="text-right">{d.cantidad}</td>
                <td className="text-right">{formatMoneda(d.precioUnitario)}</td>
                <td className="text-right">{formatMoneda(d.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Guías de remisión</h2>
          {factura.estado !== "ANULADA" && (
            <Link
              href={`/logistica/guias-remision/nueva`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline no-imprimir"
            >
              + Nueva guía
            </Link>
          )}
        </div>
        {factura.guias.length > 0 ? (
          <ul className="mt-2 text-sm">
            {factura.guias.map((g) => (
              <li key={g.id} className="py-1">
                <Link
                  href={`/logistica/guias-remision/${g.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {g.numero}
                </Link>{" "}
                — traslado del{" "}
                {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(g.fechaTraslado)} a{" "}
                {g.puntoLlegada}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500 mt-2">Sin guías registradas para esta factura.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Cobros</h2>
        {factura.cobros.length > 0 && (
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
              {factura.cobros.map((c) => (
                <tr key={c.id}>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                      c.fecha
                    )}
                  </td>
                  <td>{ETIQUETA_MEDIO_PAGO[c.medioPago]}</td>
                  <td className="text-sm text-neutral-500">{c.referencia ?? "—"}</td>
                  <td className="text-sm">{c.usuarioNombre}</td>
                  <td className="text-right">{formatMoneda(c.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {puedeOperar && factura.saldo.toNumber() > 0 && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-3">
            <CobroFormulario facturaId={factura.id} saldo={factura.saldo.toNumber()} />
          </div>
        )}
        {factura.cobros.length === 0 && (!puedeOperar || factura.saldo.toNumber() === 0) && (
          <p className="text-sm text-neutral-500 mt-2">Sin cobros registrados.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Notas de crédito</h2>
        {factura.notasCredito.length > 0 && (
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Motivo</th>
                <th>Registrado por</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {factura.notasCredito.map((nc) => (
                <tr key={nc.id}>
                  <td className="font-mono text-xs">{nc.numero}</td>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(nc.fecha)}
                  </td>
                  <td className="text-sm">{nc.motivo}</td>
                  <td className="text-sm">{nc.usuarioNombre}</td>
                  <td className="text-right">{formatMoneda(nc.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {puedeOperar && maximoNC > 0 && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-3">
            <NotaCreditoFormulario facturaId={factura.id} maximo={maximoNC} />
          </div>
        )}
        {factura.notasCredito.length === 0 && (!puedeOperar || maximoNC === 0) && (
          <p className="text-sm text-neutral-500 mt-2">Sin notas de crédito.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Comisiones de esta factura
        </h2>
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="text-right">Tasa</th>
              <th>Motivo</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {factura.comisiones.map((c) => (
              <tr key={c.id}>
                <td>{c.tipo === "GENERADA" ? "Generada" : "Reversión"}</td>
                <td className="text-right">{c.tasa.toNumber()}%</td>
                <td className="text-sm text-neutral-500">{c.motivo ?? "—"}</td>
                <td
                  className={`text-right ${
                    c.monto.toNumber() < 0 ? "text-red-600 dark:text-red-400" : ""
                  }`}
                >
                  {formatMoneda(c.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {puedeOperar && sinCobrosNiNC && (
        <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4">
          <h2 className="font-medium text-red-700 dark:text-red-400 mb-3">Zona de anulación</h2>
          <AnularFacturaFormulario facturaId={factura.id} />
        </section>
      )}
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
