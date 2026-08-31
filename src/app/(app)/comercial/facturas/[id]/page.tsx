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
  InspeccionDevolucionFormulario,
  RecargoMoraFormulario,
} from "./FormulariosFactura";
import {
  enviarComprobanteFactura,
  enviarComprobanteNotaCredito,
} from "../actions";

function DatoRetorno({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
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
  if (!usuario) redirect("/");
  const [puedeVerVentas, puedeEditarVentas, puedeInspeccionar] = await Promise.all([
    puedeRealizar(usuario, "ventas", "ver"),
    puedeRealizar(usuario, "ventas", "editar"),
    puedeRealizar(usuario, "materiales", "editar"),
  ]);
  if (!puedeVerVentas) redirect("/");

  const { id } = await params;

  const [factura, facturas, config, almacenes] = await Promise.all([
    prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        pedido: true,
        detalles: {
          include: {
            presentacion: { include: { producto: true } },
            entregas: { include: { guiaDetalle: { include: { guia: true } } } },
          },
        },
        cobros: { orderBy: { fecha: "asc" } },
        notasCredito: { orderBy: { fecha: "asc" } },
        comisiones: { orderBy: { creadoEn: "asc" } },
        guias: true,
        recargosMora: { orderBy: { fecha: "asc" } },
        devolucionesCliente: {
          orderBy: { fechaRecepcion: "asc" },
          include: {
            almacen: true,
            detalles: {
              include: {
                facturaDetalle: { include: { presentacion: { include: { producto: true } } } },
                notasCreditoDetalle: true,
              },
            },
          },
        },
      },
    }),
    prisma.factura.findMany({ include: { cliente: true }, orderBy: { fechaEmision: "desc" } }),
    prisma.configuracionEmpresa.findUnique({ where: { id: "1" } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
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
  const puedeOperar = puedeEditarVentas && factura.estado !== "ANULADA";
  const sinCobrosNiNC = factura.cobros.length === 0 && factura.notasCredito.length === 0;

  // Notas de crédito: cuánto de cada línea ya se acreditó, para saber cuánto
  // falta disponible (mismo principio que las devoluciones más abajo).
  const notaCreditoDetalles = await prisma.notaCreditoDetalle.findMany({
    where: {
      notaCredito: { facturaId: factura.id },
      pedidoDetalleId: { in: factura.detalles.map((d) => d.pedidoDetalleId) },
    },
  });
  const yaAcreditadoPorLinea = new Map<string, number>();
  for (const d of notaCreditoDetalles) {
    yaAcreditadoPorLinea.set(
      d.pedidoDetalleId,
      (yaAcreditadoPorLinea.get(d.pedidoDetalleId) ?? 0) + d.cantidad.toNumber()
    );
  }
  const lineasAcreditables = factura.detalles.map((d) => ({
    clave: d.pedidoDetalleId,
    pedidoDetalleId: d.pedidoDetalleId,
    etiqueta: `${d.presentacion.producto.nombre} — ${d.presentacion.nombre}`,
    precioUnitario: d.precioUnitario.toNumber(),
    maxAcreditable: d.cantidad - (yaAcreditadoPorLinea.get(d.pedidoDetalleId) ?? 0),
  }));
  const lineasDevolucionAcreditables = factura.devolucionesCliente.flatMap((devolucion) =>
    devolucion.detalles.flatMap((detalle) => {
      if (detalle.decision === "PENDIENTE") return [];
      const acreditado = detalle.notasCreditoDetalle.reduce((total, linea) => total + linea.cantidad.toNumber(), 0);
      const maxAcreditable = detalle.cantidadAcreditable - acreditado;
      if (maxAcreditable <= 0) return [];
      return [{
        clave: detalle.id,
        pedidoDetalleId: detalle.facturaDetalle.pedidoDetalleId,
        devolucionDetalleId: detalle.id,
        etiqueta: `${devolucion.numero} · ${detalle.facturaDetalle.presentacion.producto.nombre} — ${detalle.facturaDetalle.presentacion.nombre}`,
        precioUnitario: detalle.facturaDetalle.precioUnitario.toNumber(),
        maxAcreditable,
      }];
    })
  );  const hayLineasAcreditables = [...lineasAcreditables, ...lineasDevolucionAcreditables].some((l) => l.maxAcreditable > 0);
  const puedeCrearNotaCredito = puedeOperar && factura.saldo.toNumber() > 0 && hayLineasAcreditables;
  const seriesNC = puedeCrearNotaCredito ? await seriesActivas("NOTA_CREDITO") : [];

  // El documento de devolución es la fuente; lo retornado físicamente al
  // cliente vuelve a quedar disponible para una recepción posterior.
  const recibidoNetoPorLinea = new Map<string, number>();
  for (const devolucion of factura.devolucionesCliente) {
    for (const detalle of devolucion.detalles) {
      recibidoNetoPorLinea.set(
        detalle.facturaDetalleId,
        (recibidoNetoPorLinea.get(detalle.facturaDetalleId) ?? 0) +
          detalle.cantidad -
          detalle.cantidadDevolverCliente
      );
    }
  }
  const lineasDevolvibles = factura.detalles.map((detalle) => ({
    facturaDetalleId: detalle.id,
    etiqueta: `${detalle.presentacion.producto.nombre} — ${detalle.presentacion.nombre}`,
    maxDevolvible: detalle.cantidad - (recibidoNetoPorLinea.get(detalle.id) ?? 0),
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

      <div className="mt-4 rounded-md border border-black/10 bg-neutral-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900">
        Moneda del documento: <strong>{factura.moneda}</strong> · Tipo de cambio de emisión: <strong>{factura.tipoCambio.toString()}</strong> · Total funcional: <strong>{formatMoneda(factura.totalFuncional, factura.monedaFuncional)}</strong>
      </div>
      {factura.moneda !== "PEN" && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Operación USD: cobranza, notas de crédito, anulación y mora se valorizan en PEN con el tipo de cambio congelado de cada operación.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
        <Dato
          etiqueta="Valor de venta"
          valor={formatMoneda(
            factura.subtotal.toNumber() > 0 ? factura.subtotal : factura.total,
            factura.moneda
          )}
        />
        <Dato
          etiqueta={`IGV (${factura.tasaIgv.toNumber()}%)`}
          valor={formatMoneda(factura.igv, factura.moneda)}
        />
        <Dato etiqueta="Total" valor={formatMoneda(factura.total, factura.moneda)} />
        <Dato etiqueta="Notas de crédito" valor={formatMoneda(totalNC, factura.moneda)} />
        <Dato etiqueta="Saldo por cobrar" valor={formatMoneda(factura.saldo, factura.moneda)} />
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
              <th>Entrega fuente</th>
              <th className="text-right">Precio unit.</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {factura.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.presentacion.producto.nombre} — {d.presentacion.nombre}
                </td>
                <td className="text-right">{d.cantidad}</td>
                <td className="text-xs">
                  {d.entregas.length > 0
                    ? d.entregas
                        .map((entrega) => `${entrega.guiaDetalle.guia.numero} (${entrega.cantidad})`)
                        .join(", ")
                    : "Facturación directa histórica"}
                </td>
                <td className="text-right">{formatMoneda(d.precioUnitario, factura.moneda)}</td>
                <td className="text-right">{formatMoneda(d.subtotal, factura.moneda)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="text-right text-neutral-500">
                Valor de venta
              </td>
              <td className="text-right">
                {formatMoneda(factura.subtotal.toNumber() > 0 ? factura.subtotal : factura.total, factura.moneda)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right text-neutral-500">
                IGV ({factura.tasaIgv.toNumber()}%)
              </td>
              <td className="text-right">{formatMoneda(factura.igv, factura.moneda)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right font-semibold">
                Total
              </td>
              <td className="text-right font-semibold">{formatMoneda(factura.total, factura.moneda)}</td>
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
                  <td className="text-right">
                    {formatMoneda(c.monto, c.moneda)}
                    <span className="block text-xs text-neutral-400">
                      {formatMoneda(c.montoFuncional, factura.monedaFuncional)} · TC {c.tipoCambio.toString()}
                      {c.diferenciaCambio.toNumber() !== 0 ? ` · Dif. ${formatMoneda(c.diferenciaCambio, factura.monedaFuncional)}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {puedeOperar && factura.saldo.toNumber() > 0 && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-3">
            <CobroFormulario
              facturaId={factura.id}
              saldo={factura.saldo.toNumber()}
              moneda={factura.moneda}
              tipoCambioFactura={factura.tipoCambio.toNumber()}
            />
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
                    <td className="text-right">
                      {formatMoneda(r.monto, r.moneda)}
                      <span className="block text-xs text-neutral-400">
                        {formatMoneda(r.montoFuncional, factura.monedaFuncional)} · TC {r.tipoCambio.toString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {puedeAplicarMora && (
            <RecargoMoraFormulario
              facturaId={factura.id}
              tasa={config?.tasaRecargoMora.toNumber() ?? 0}
            />
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
                    <td className="text-right">
                      {formatMoneda(nc.monto, nc.moneda)}
                      <span className="block text-xs text-neutral-400">
                        {formatMoneda(nc.montoFuncional, factura.monedaFuncional)} · TC {nc.tipoCambio.toString()}
                      </span>
                    </td>
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
        {puedeCrearNotaCredito && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-3">
            <NotaCreditoFormulario
              facturaId={factura.id}
              lineas={lineasAcreditables}
              lineasDevolucion={lineasDevolucionAcreditables}
              series={seriesNC.map((s) => ({
                id: s.id,
                serie: s.serie,
                correlativoActual: s.correlativoActual,
              }))}
            />
          </div>
        )}
        {factura.notasCredito.length === 0 && !puedeCrearNotaCredito && (
          <p className="text-sm text-neutral-500 mt-2">Sin notas de crédito.</p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Devoluciones de cliente</h2>
            <p className="mt-1 text-xs text-neutral-500">Recepción bloqueada → inspección → decisión de uso → compensación.</p>
          </div>
          {factura.devolucionesCliente.some((devolucion) => devolucion.estado === "PENDIENTE_INSPECCION") && (
            <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pendiente de Calidad</span>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {factura.devolucionesCliente.map((devolucion) => (
            <article key={devolucion.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{devolucion.numero}</p>
                  <p className="text-xs text-neutral-500">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(devolucion.fechaRecepcion)} · {devolucion.almacen.codigo} — {devolucion.almacen.nombre}
                  </p>
                  <p className="mt-1 text-sm">{devolucion.motivo}</p>
                </div>
                <span className={`insignia ${devolucion.estado === "CERRADA" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                  {devolucion.estado === "CERRADA" ? "Inspección cerrada" : "Stock bloqueado"}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {devolucion.detalles.map((detalle) => {
                  const acreditado = detalle.notasCreditoDetalle.reduce((total, linea) => total + linea.cantidad.toNumber(), 0);
                  return (
                    <div key={detalle.id} className="border-t border-black/5 pt-3 dark:border-white/5">
                      <div className="grid gap-2 text-sm md:grid-cols-6">
                        <div className="md:col-span-2">
                          <p className="font-medium">{detalle.facturaDetalle.presentacion.producto.nombre} — {detalle.facturaDetalle.presentacion.nombre}</p>
                          <p className="text-xs text-neutral-500">Recibido: {detalle.cantidad}</p>
                        </div>
                        <DatoRetorno etiqueta="Reingreso" valor={detalle.cantidadReingreso} />
                        <DatoRetorno etiqueta="Desecho" valor={detalle.cantidadDesecho} />
                        <DatoRetorno etiqueta="Al cliente" valor={detalle.cantidadDevolverCliente} />
                        <DatoRetorno etiqueta="Compensable / NC" valor={`${detalle.cantidadAcreditable} / ${acreditado}`} />
                      </div>
                      {detalle.observacionCalidad && <p className="mt-2 text-xs text-neutral-500">Calidad: {detalle.observacionCalidad}</p>}
                      {detalle.decision === "PENDIENTE" && puedeInspeccionar && (
                        <InspeccionDevolucionFormulario detalleId={detalle.id} cantidad={detalle.cantidad} />
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        {puedeOperar && lineasDevolvibles.some((linea) => linea.maxDevolvible > 0) && (
          <div className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="mb-3 text-sm font-semibold">Nueva recepción de devolución</h3>
            <DevolucionFormulario
              facturaId={factura.id}
              lineas={lineasDevolvibles}
              almacenes={almacenes.map((almacen) => ({ id: almacen.id, etiqueta: `${almacen.codigo} — ${almacen.nombre}` }))}
            />
          </div>
        )}
        {factura.devolucionesCliente.length === 0 && !puedeOperar && (
          <p className="mt-2 text-sm text-neutral-500">Sin devoluciones registradas.</p>
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
