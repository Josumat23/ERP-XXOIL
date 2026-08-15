import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import {
  ETIQUETA_ESTADO_FACTURA,
  ETIQUETA_CONDICION_PAGO,
  ETIQUETA_MEDIO_PAGO,
  MOTIVO_DEVOLUCION_PREFIJO,
  ETIQUETA_ESTADO_SUNAT,
  COLOR_ESTADO_SUNAT,
} from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { seriesActivas } from "@/lib/series";
import { ETIQUETA_TIPO_NOTA_CREDITO } from "@/lib/catalogosSunat";
import {
  CobroFormulario,
  NotaCreditoFormulario,
  AnularFacturaFormulario,
  DevolucionFormulario,
} from "./FormulariosFactura";
import {
  aplicarRecargoMora,
  enviarComprobanteFactura,
  enviarComprobanteNotaCredito,
} from "../actions";

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
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const { id } = await params;

  const [factura, facturas, config] = await Promise.all([
    prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        pedido: { include: { detalles: { include: { presentacion: { include: { producto: true } } } } } },
        cobros: { orderBy: { fecha: "asc" } },
        notasCredito: { orderBy: { fecha: "asc" } },
        comisiones: { orderBy: { creadoEn: "asc" } },
        guias: true,
        recargosMora: { orderBy: { fecha: "asc" } },
      },
    }),
    prisma.factura.findMany({ include: { cliente: true }, orderBy: { fechaEmision: "desc" } }),
    prisma.configuracionEmpresa.findUnique({ where: { id: "1" } }),
  ]);
  if (!factura) notFound();

  const comprobantes = await prisma.comprobanteElectronico.findMany({
    where: {
      OR: [
        { tipoDocumento: "FACTURA", documentoId: id },
        { tipoDocumento: "NOTA_CREDITO", documentoId: { in: factura.notasCredito.map((nc) => nc.id) } },
      ],
    },
  });
  const comprobanteFactura = comprobantes.find((c) => c.tipoDocumento === "FACTURA");
  const comprobantePorNotaCredito = new Map(
    comprobantes.filter((c) => c.tipoDocumento === "NOTA_CREDITO").map((c) => [c.documentoId, c])
  );

  const vencida = factura.estado === "PENDIENTE" && factura.fechaVencimiento < new Date();
  const puedeAplicarMora = vencida && (config?.tasaRecargoMora.toNumber() ?? 0) > 0;

  const totalNC = factura.notasCredito.reduce((acc, nc) => acc + nc.monto.toNumber(), 0);
  const puedeOperar = factura.estado !== "ANULADA";
  const sinCobrosNiNC = factura.cobros.length === 0 && factura.notasCredito.length === 0;

  // Notas de crédito: cuánto de cada línea ya se acreditó, para saber cuánto
  // falta disponible (mismo principio que las devoluciones más abajo).
  const notaCreditoDetalles = await prisma.notaCreditoDetalle.findMany({
    where: { pedidoDetalleId: { in: factura.pedido.detalles.map((d) => d.id) } },
  });
  const yaAcreditadoPorLinea = new Map<string, number>();
  for (const d of notaCreditoDetalles) {
    yaAcreditadoPorLinea.set(
      d.pedidoDetalleId,
      (yaAcreditadoPorLinea.get(d.pedidoDetalleId) ?? 0) + d.cantidad.toNumber()
    );
  }
  const lineasAcreditables = factura.pedido.detalles.map((d) => ({
    pedidoDetalleId: d.id,
    etiqueta: `${d.presentacion.producto.nombre} — ${d.presentacion.nombre}`,
    precioUnitario: d.precioUnitario.toNumber(),
    maxAcreditable: d.cantidad - (yaAcreditadoPorLinea.get(d.id) ?? 0),
  }));
  const hayLineasAcreditables = lineasAcreditables.some((l) => l.maxAcreditable > 0);
  const seriesNC = puedeOperar && hayLineasAcreditables ? await seriesActivas("NOTA_CREDITO") : [];

  // Devoluciones: cuánto de cada línea ya se devolvió, para saber cuánto falta.
  const liberacionesPorDevolucion = await prisma.asignacionLoteVenta.findMany({
    where: {
      tipo: "LIBERADA",
      motivo: { startsWith: MOTIVO_DEVOLUCION_PREFIJO },
      pedidoDetalleId: { in: factura.pedido.detalles.map((d) => d.id) },
    },
    orderBy: { creadoEn: "asc" },
  });
  const yaDevueltoPorLinea = new Map<string, number>();
  for (const l of liberacionesPorDevolucion) {
    yaDevueltoPorLinea.set(l.pedidoDetalleId, (yaDevueltoPorLinea.get(l.pedidoDetalleId) ?? 0) + l.cantidad);
  }
  const lineasDevolvibles = factura.pedido.detalles.map((d) => ({
    pedidoDetalleId: d.id,
    etiqueta: `${d.presentacion.producto.nombre} — ${d.presentacion.nombre}`,
    maxDevolvible: d.cantidad - (yaDevueltoPorLinea.get(d.id) ?? 0),
  }));

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/comercial/facturas" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a facturas
        </Link>
        <BotonImprimir />
      </div>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={facturas.map((f) => ({
          id: f.id,
          href: `/comercial/facturas/${f.id}`,
          primario: f.numero,
          secundario: f.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
      <MembreteEmpresa soloImprimir tituloDocumento="FACTURA" numero={factura.numero} />

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

      <div className="mt-4 flex items-center gap-3 no-imprimir">
        <span
          className={`insignia ${
            COLOR_ESTADO_SUNAT[comprobanteFactura?.estado ?? "PENDIENTE"]
          }`}
        >
          SUNAT: {ETIQUETA_ESTADO_SUNAT[comprobanteFactura?.estado ?? "PENDIENTE"]}
        </span>
        {comprobanteFactura?.sunatDescripcion && (
          <span className="text-xs text-neutral-500">{comprobanteFactura.sunatDescripcion}</span>
        )}
        {comprobanteFactura?.enlacePdf && (
          <a
            href={comprobanteFactura.enlacePdf}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
          >
            Ver PDF SUNAT
          </a>
        )}
        {factura.estado !== "ANULADA" &&
          comprobanteFactura?.estado !== "ACEPTADO" &&
          comprobanteFactura?.estado !== "OBSERVADO" && (
          <form
            action={async () => {
              "use server";
              await enviarComprobanteFactura(factura.id);
              revalidatePath(`/comercial/facturas/${factura.id}`);
            }}
          >
            <button type="submit" className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline">
              {comprobanteFactura ? "Reenviar a SUNAT" : "Enviar a SUNAT"}
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
        <Dato
          etiqueta="Valor de venta"
          valor={formatMoneda(
            factura.subtotal.toNumber() > 0 ? factura.subtotal : factura.total
          )}
        />
        <Dato
          etiqueta={`IGV (${factura.tasaIgv.toNumber()}%)`}
          valor={formatMoneda(factura.igv)}
        />
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
            <tr>
              <td colSpan={3} className="text-right text-neutral-500">
                Valor de venta
              </td>
              <td className="text-right">
                {formatMoneda(factura.subtotal.toNumber() > 0 ? factura.subtotal : factura.total)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right text-neutral-500">
                IGV ({factura.tasaIgv.toNumber()}%)
              </td>
              <td className="text-right">{formatMoneda(factura.igv)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right font-semibold">
                Total
              </td>
              <td className="text-right font-semibold">{formatMoneda(factura.total)}</td>
            </tr>
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

      {(factura.recargosMora.length > 0 || puedeAplicarMora) && (
        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Recargo por mora</h2>
          {factura.recargosMora.length > 0 && (
            <table className="tabla mt-2">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="text-right">Días</th>
                  <th className="text-right">Tasa</th>
                  <th className="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {factura.recargosMora.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-neutral-500 whitespace-nowrap">
                      {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(r.fecha)}
                    </td>
                    <td className="text-right">{r.diasCalculados}</td>
                    <td className="text-right">{r.tasaAplicada.toNumber()}%/mes</td>
                    <td className="text-right">{formatMoneda(r.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {puedeAplicarMora && (
            <form
              action={async () => {
                "use server";
                await aplicarRecargoMora(factura.id);
              }}
              className="mt-3"
            >
              <button type="submit" className="boton-secundario text-xs">
                Aplicar recargo por mora ({config?.tasaRecargoMora.toNumber()}%/mes)
              </button>
            </form>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Notas de crédito</h2>
        {factura.notasCredito.length > 0 && (
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Registrado por</th>
                <th className="text-right">Monto</th>
                <th className="no-imprimir">SUNAT</th>
              </tr>
            </thead>
            <tbody>
              {factura.notasCredito.map((nc) => {
                const comprobanteNc = comprobantePorNotaCredito.get(nc.id);
                return (
                  <tr key={nc.id}>
                    <td className="font-mono text-xs">{nc.numero}</td>
                    <td className="text-xs text-neutral-500 whitespace-nowrap">
                      {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(nc.fecha)}
                    </td>
                    <td className="text-xs text-neutral-500">{ETIQUETA_TIPO_NOTA_CREDITO[nc.tipoNota]}</td>
                    <td className="text-sm">{nc.motivo}</td>
                    <td className="text-sm">{nc.usuarioNombre}</td>
                    <td className="text-right">{formatMoneda(nc.monto)}</td>
                    <td className="no-imprimir">
                      <div className="flex items-center gap-2">
                        <span
                          className={`insignia ${COLOR_ESTADO_SUNAT[comprobanteNc?.estado ?? "PENDIENTE"]}`}
                        >
                          {ETIQUETA_ESTADO_SUNAT[comprobanteNc?.estado ?? "PENDIENTE"]}
                        </span>
                        {comprobanteNc?.estado !== "ACEPTADO" && comprobanteNc?.estado !== "OBSERVADO" && (
                          <form
                            action={async () => {
                              "use server";
                              await enviarComprobanteNotaCredito(nc.id);
                              revalidatePath(`/comercial/facturas/${factura.id}`);
                            }}
                          >
                            <button type="submit" className="text-xs text-neutral-500 hover:underline">
                              Enviar
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {puedeOperar && hayLineasAcreditables && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-3">
            <NotaCreditoFormulario
              facturaId={factura.id}
              lineas={lineasAcreditables}
              series={seriesNC.map((s) => ({
                id: s.id,
                serie: s.serie,
                correlativoActual: s.correlativoActual,
              }))}
            />
          </div>
        )}
        {factura.notasCredito.length === 0 && (!puedeOperar || !hayLineasAcreditables) && (
          <p className="text-sm text-neutral-500 mt-2">Sin notas de crédito.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
          Devoluciones de mercadería
        </h2>
        {liberacionesPorDevolucion.length > 0 && (
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Motivo</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {liberacionesPorDevolucion.map((l) => (
                <tr key={l.id}>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(l.creadoEn)}
                  </td>
                  <td className="text-sm">{l.motivo}</td>
                  <td className="text-right">{l.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {puedeOperar && lineasDevolvibles.some((l) => l.maxDevolvible > 0) && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-3">
            <DevolucionFormulario facturaId={factura.id} lineas={lineasDevolvibles} />
          </div>
        )}
        {liberacionesPorDevolucion.length === 0 &&
          (!puedeOperar || !lineasDevolvibles.some((l) => l.maxDevolvible > 0)) && (
            <p className="text-sm text-neutral-500 mt-2">Sin devoluciones registradas.</p>
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
      </PanelMaestroDetalle>
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
