import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_ESTADO_PEDIDO } from "@/lib/etiquetas";
import { seriesActivas } from "@/lib/series";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { aprobarCreditoPedido, anularPedido } from "../actions";
import FacturarFormulario from "./FacturarFormulario";
import ResolverCreditoFormulario from "./ResolverCreditoFormulario";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PARCIAL: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  FACTURADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADO: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const { id } = await params;

  const [pedido, pedidos] = await Promise.all([
    prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        almacen: true,
        facturas: { orderBy: { fechaEmision: "desc" } },
        guias: { orderBy: { creadoEn: "desc" } },
        detalles: {
          include: {
            presentacion: { include: { producto: true } },
            facturaDetalles: { include: { factura: { select: { estado: true } } } },
            guiaDetalles: { include: { guia: { select: { estadoDespacho: true } } } },
          },
        },
      },
    }),
    prisma.pedido.findMany({ include: { cliente: true }, orderBy: { fecha: "desc" } }),
  ]);
  if (!pedido) notFound();

  const lineasFacturacion = pedido.detalles.map((detalle) => {
    const facturado = detalle.facturaDetalles
      .filter((fd) => fd.factura.estado !== "ANULADA")
      .reduce((total, fd) => total + fd.cantidad, 0);
    const planificado = detalle.guiaDetalles
      .filter((gd) => gd.guia.estadoDespacho !== "ANULADO")
      .reduce((total, gd) => total + gd.cantidad, 0);
    const entregadoReal = detalle.guiaDetalles
      .filter((gd) => gd.guia.estadoDespacho === "EN_RUTA" || gd.guia.estadoDespacho === "ENTREGADO")
      .reduce((total, gd) => total + gd.cantidad, 0);
    const entregado = pedido.requiereEntrega ? entregadoReal : detalle.cantidad;
    return {
      id: detalle.id,
      etiqueta: `${detalle.presentacion.producto.nombre} — ${detalle.presentacion.nombre}`,
      sku: detalle.presentacion.sku,
      cantidadPedida: detalle.cantidad,
      cantidadPlanificada: planificado,
      cantidadEntregada: entregado,
      cantidadFacturada: facturado,
      saldo: entregado - facturado,
      precioUnitario: detalle.precioUnitario.toNumber(),
    };
  });  const puedeFacturar =
    (pedido.estado === "PENDIENTE" || pedido.estado === "PARCIAL") &&
    lineasFacturacion.some((linea) => linea.saldo > 0);
  const series = puedeFacturar ? await seriesActivas("FACTURA") : [];
  const puedeAprobarCredito =
    pedido.estadoAprobacionCredito === "PENDIENTE" &&
    usuario !== null &&
    (usuario.rol === "ADMIN" || usuario.rol === "GERENCIA") &&
    (await puedeRealizar(usuario, "ventas", "aprobar"));

  return (
    <div>
      <Link href="/comercial/pedidos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a pedidos
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/comercial/pedidos/nuevo"
        nuevoTexto="Nuevo pedido"
        registros={pedidos.map((p) => ({
          id: p.id,
          href: `/comercial/pedidos/${p.id}`,
          primario: p.numero,
          secundario: p.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
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

      <section className="mt-6 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
          Condiciones comerciales y logísticas
        </p>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-neutral-500">Centro de despacho</dt>
            <dd className="font-medium">{pedido.almacen ? `${pedido.almacen.codigo} — ${pedido.almacen.nombre}` : "Sin asignar (pedido histórico)"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Entrega solicitada</dt>
            <dd className="font-medium">{pedido.fechaEntregaSolicitada ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(pedido.fechaEntregaSolicitada) : "Sin fecha (pedido histórico)"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Condición de pago</dt>
            <dd className="font-medium">{pedido.condicionPago === "CONTADO" ? "Contado" : pedido.condicionPago === "DIAS_15" ? "Crédito 15 días" : "Crédito 30 días"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Moneda / tipo de cambio</dt>
            <dd className="font-medium">{pedido.moneda} / {pedido.tipoCambio.toString()}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">OC del cliente</dt>
            <dd className="font-medium">{pedido.ordenCompraCliente ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Referencia</dt>
            <dd className="font-medium">{pedido.referenciaCliente ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-neutral-500">Dirección de entrega</dt>
            <dd className="font-medium">{pedido.direccionEntrega ?? "Sin dirección (pedido histórico)"}</dd>
          </div>
        </dl>
      </section>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Presentación</th>
            <th className="text-right">Pedido</th>
            <th className="text-right">Entregado</th>
            <th className="text-right">Facturado</th>
            <th className="text-right">Saldo</th>
            <th className="text-right">Precio lista</th>
            <th className="text-right">Descuento</th>
            <th className="text-right">Precio neto</th>
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
              <td className="text-right">{lineasFacturacion.find((linea) => linea.id === d.id)?.cantidadEntregada ?? 0}</td>
              <td className="text-right">{lineasFacturacion.find((linea) => linea.id === d.id)?.cantidadFacturada ?? 0}</td>
              <td className="text-right font-medium">{lineasFacturacion.find((linea) => linea.id === d.id)?.saldo ?? d.cantidad}</td>
              <td className="text-right">
                {formatMoneda(d.precioLista, pedido.moneda)}
                <span className="block text-xs text-neutral-400">
                  {d.origenPrecio === "ESCALON" ? `Escalón desde ${d.cantidadMinimaPrecio}` : d.origenPrecio === "BASE" ? "Base" : "Histórico"}
                </span>
              </td>
              <td className="text-right">
                {d.descuentoPct.toNumber()}%
                <span className="block text-xs text-neutral-400">-{formatMoneda(d.descuentoMonto, pedido.moneda)}</span>
              </td>
              <td className="text-right">{formatMoneda(d.precioUnitario, pedido.moneda)}</td>
              <td className="text-right">{formatMoneda(d.subtotal, pedido.moneda)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={8} className="text-right">Subtotal bruto</td>
            <td className="text-right">{formatMoneda(pedido.subtotalBruto, pedido.moneda)}</td>
          </tr>
          <tr>
            <td colSpan={8} className="text-right">Descuentos</td>
            <td className="text-right">-{formatMoneda(pedido.descuentoTotal, pedido.moneda)}</td>
          </tr>
          <tr>
            <td colSpan={8} className="text-right font-medium">Base imponible</td>
            <td className="text-right font-medium">{formatMoneda(pedido.total, pedido.moneda)}</td>
          </tr>
          <tr>
            <td colSpan={8} className="text-right">IGV ({pedido.tasaIgv.toNumber()}%)</td>
            <td className="text-right">{formatMoneda(pedido.igv, pedido.moneda)}</td>
          </tr>
          <tr>
            <td colSpan={8} className="text-right font-semibold">Total del documento</td>
            <td className="text-right font-semibold">{formatMoneda(pedido.totalConIgv, pedido.moneda)}</td>
          </tr>
        </tbody>
      </table>


      {pedido.estadoAprobacionCredito === "PENDIENTE" && (
        <section className="mt-8 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Excepción de crédito pendiente</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Deuda actual {formatMoneda(pedido.deudaCreditoEvaluada ?? 0)} + factura proyectada {formatMoneda(pedido.montoCreditoEvaluado ?? 0)} supera el límite de {formatMoneda(pedido.limiteCreditoEvaluado ?? 0)}. Condición solicitada: {pedido.condicionPagoCredito === "DIAS_15" ? "Crédito 15 días" : "Crédito 30 días"}.
          </p>
          {puedeAprobarCredito ? (
            <div className="flex flex-col gap-3 mt-4">
              <form action={async () => { "use server"; await aprobarCreditoPedido(pedido.id); }}>
                <button type="submit" className="boton-primario text-sm">Aprobar excepción</button>
              </form>
              <ResolverCreditoFormulario pedidoId={pedido.id} />
            </div>
          ) : (
            <p className="text-xs text-neutral-500 mt-3">Solo Gerencia o un Administrador con permiso de aprobación de Ventas puede resolverla.</p>
          )}
        </section>
      )}

      {pedido.estadoAprobacionCredito === "APROBADA" && (
        <section className="mt-8 border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-green-800 dark:text-green-400">Excepción de crédito aprobada</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Aprobada por {pedido.creditoResueltoPor} para {formatMoneda(pedido.montoCreditoEvaluado ?? 0)} y la condición evaluada. Facture usando esa misma condición.
          </p>
        </section>
      )}

      {pedido.estadoAprobacionCredito === "RECHAZADA" && (
        <section className="mt-8 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-red-700 dark:text-red-400">Excepción de crédito rechazada</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {pedido.motivoRechazoCredito} — {pedido.creditoResueltoPor}. Puede facturar al contado o reevaluar después de reducir la deuda.
          </p>
        </section>
      )}
      {puedeFacturar && (
        <>
          <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
              Facturar este pedido
            </h2>
            <FacturarFormulario
              pedidoId={pedido.id}
              condicionDefecto={pedido.condicionPago}
              moneda={pedido.moneda}
              tasaIgv={pedido.tasaIgv.toNumber()}
              lineas={lineasFacturacion}
              requiereEntrega={pedido.requiereEntrega}
              series={series.map((s) => ({
                id: s.id,
                serie: s.serie,
                correlativoActual: s.correlativoActual,
              }))}
            />
          </section>

          {pedido.estado === "PENDIENTE" && pedido.facturas.length === 0 && (
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
          )}
        </>
      )}

      {pedido.requiereEntrega && (
        <section className="mt-8 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Entregas y guías</h2>
              <p className="mt-1 text-xs text-neutral-500">
                La salida física ocurre al marcar la guía en ruta; después queda disponible para facturación.
              </p>
            </div>
            {lineasFacturacion.some((linea) => linea.cantidadPlanificada < linea.cantidadPedida) && (
              <Link href={`/logistica/guias-remision/nueva?pedidoId=${pedido.id}`} className="boton-primario text-sm">
                Crear entrega parcial
              </Link>
            )}
          </div>
          {pedido.guias.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {pedido.guias.map((guia) => (
                <Link key={guia.id} href={`/logistica/guias-remision/${guia.id}`} className="insignia bg-neutral-100 text-neutral-700 hover:underline dark:bg-neutral-800 dark:text-neutral-300">
                  {guia.numero} · {guia.estadoDespacho === "PLANIFICADO" ? "Planificada" : guia.estadoDespacho === "EN_RUTA" ? "En ruta" : guia.estadoDespacho === "ENTREGADO" ? "Entregada" : "Anulada"}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Aún no hay entregas planificadas.</p>
          )}
        </section>
      )}
      {pedido.facturas.length > 0 && (
        <div className="mt-6 text-sm">
          <span className="font-medium">Facturas asociadas:</span>{" "}
          <Link
            href={`/comercial/facturas/${pedido.facturas[0].id}`}
            className="font-mono hover:underline"
          >
            {pedido.facturas[0].numero}
          </Link>
          {pedido.facturas.slice(1).map((factura) => (
            <span key={factura.id}> · <Link href={`/comercial/facturas/${factura.id}`} className="font-mono hover:underline">{factura.numero}</Link></span>
          ))}
        </div>
      )}
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
