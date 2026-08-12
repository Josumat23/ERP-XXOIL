import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { formatMoneda } from "@/lib/format";

function Tarjeta({ titulo, cantidad, detalle }: { titulo: string; cantidad: number; detalle: string }) {
  return (
    <div className="rounded-xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-4">
      <p className="text-sm text-[var(--epicor-texto-tenue)]">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold text-[var(--epicor-texto)]">{cantidad}</p>
      <p className="mt-1 text-xs text-[var(--epicor-texto-tenue)]">{detalle}</p>
    </div>
  );
}

export default async function AprobacionesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");

  const [creditos, compras, pagos] = await Promise.all([
    prisma.pedido.findMany({
      where: { estado: "PENDIENTE", estadoAprobacionCredito: "PENDIENTE" },
      include: { cliente: true },
      orderBy: { creditoSolicitadoEn: "asc" },
    }),
    prisma.ordenCompra.findMany({
      where: { estadoAprobacion: "PENDIENTE" },
      include: { proveedor: true },
      orderBy: { fecha: "asc" },
    }),
    prisma.pagoProveedor.findMany({
      where: { estadoAprobacion: "PENDIENTE" },
      include: { cuentaPorPagar: { include: { proveedor: true } } },
      orderBy: { fecha: "asc" },
    }),
  ]);

  const total = creditos.length + compras.length + pagos.length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--epicor-texto)]">Bandeja de aprobaciones</h1>
          <p className="mt-1 text-sm text-[var(--epicor-texto-tenue)]">
            Decisiones pendientes de Gerencia. Abra el documento para revisar antecedentes y resolverlo.
          </p>
        </div>
        <span className="insignia bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
          {total} {total === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tarjeta titulo="Excepciones de crédito" cantidad={creditos.length} detalle="Pedidos sobre el límite del cliente" />
        <Tarjeta titulo="Órdenes de compra" cantidad={compras.length} detalle="Compras sobre el umbral configurado" />
        <Tarjeta titulo="Pagos a proveedores" cantidad={pagos.length} detalle="Egresos que requieren autorización" />
      </div>

      {total === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--epicor-borde)] p-10 text-center text-sm text-[var(--epicor-texto-tenue)]">
          No hay decisiones pendientes.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--epicor-texto)]">Crédito de clientes</h2>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Pedido</th><th>Cliente</th><th className="text-right">Deuda</th><th className="text-right">Factura</th><th className="text-right">Límite</th><th /></tr></thead><tbody>
              {creditos.map((pedido) => <tr key={pedido.id}><td className="font-mono">{pedido.numero}</td><td>{pedido.cliente.razonSocial}</td><td className="text-right">{formatMoneda(pedido.deudaCreditoEvaluada ?? 0)}</td><td className="text-right">{formatMoneda(pedido.montoCreditoEvaluado ?? 0)}</td><td className="text-right">{formatMoneda(pedido.limiteCreditoEvaluado ?? 0)}</td><td className="text-right"><Link className="text-[var(--epicor-azul)] hover:underline" href={`/comercial/pedidos/${pedido.id}`}>Revisar</Link></td></tr>)}
              {creditos.length === 0 && <tr><td colSpan={6} className="text-center text-[var(--epicor-texto-tenue)]">Sin excepciones pendientes</td></tr>}
            </tbody></table></div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--epicor-texto)]">Órdenes de compra</h2>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Orden</th><th>Proveedor</th><th>Moneda</th><th className="text-right">Total</th><th /></tr></thead><tbody>
              {compras.map((orden) => <tr key={orden.id}><td className="font-mono">{orden.numero}</td><td>{orden.proveedor.razonSocial}</td><td>{orden.moneda}</td><td className="text-right">{formatMoneda(orden.total)}</td><td className="text-right"><Link className="text-[var(--epicor-azul)] hover:underline" href={`/logistica/ordenes-compra/${orden.id}`}>Revisar</Link></td></tr>)}
              {compras.length === 0 && <tr><td colSpan={5} className="text-center text-[var(--epicor-texto-tenue)]">Sin órdenes pendientes</td></tr>}
            </tbody></table></div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--epicor-texto)]">Pagos a proveedores</h2>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Proveedor</th><th>Documento</th><th>Medio</th><th className="text-right">Monto</th><th /></tr></thead><tbody>
              {pagos.map((pago) => <tr key={pago.id}><td>{pago.cuentaPorPagar.proveedor.razonSocial}</td><td>{pago.cuentaPorPagar.numeroDocumento}</td><td>{pago.medioPago}</td><td className="text-right">{formatMoneda(pago.monto)}</td><td className="text-right"><Link className="text-[var(--epicor-azul)] hover:underline" href={`/finanzas/cuentas-por-pagar/${pago.cuentaPorPagarId}`}>Revisar</Link></td></tr>)}
              {pagos.length === 0 && <tr><td colSpan={5} className="text-center text-[var(--epicor-texto-tenue)]">Sin pagos pendientes</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      )}
    </div>
  );
}