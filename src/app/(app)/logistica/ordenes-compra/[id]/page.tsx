import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_OC } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import RecepcionFormulario from "./RecepcionFormulario";
import AnularOCFormulario from "./AnularOCFormulario";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PARCIAL: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  RECIBIDA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function DetalleOrdenCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const oc = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      detalles: { include: { insumo: true } },
      recepciones: { include: { detalles: { include: { insumo: true } } }, orderBy: { fecha: "asc" } },
      cuentasPorPagar: true,
    },
  });
  if (!oc) notFound();

  const pendientes = oc.detalles
    .map((d) => ({
      detalleId: d.id,
      nombre: `${d.insumo.codigo} — ${d.insumo.nombre}`,
      unidad: d.insumo.unidadMedida,
      pendiente: d.cantidad.toNumber() - d.cantidadRecibida.toNumber(),
      costoUnitario: d.costoUnitario.toNumber(),
    }))
    .filter((d) => d.pendiente > 1e-9);

  const admiteRecepcion = oc.estado === "PENDIENTE" || oc.estado === "PARCIAL";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/logistica/ordenes-compra" className="text-sm text-neutral-500 hover:underline">
          ← Volver a órdenes de compra
        </Link>
        <BotonImprimir />
      </div>

      <div className="documento">
        <MembreteEmpresa soloImprimir tituloDocumento="ORDEN DE COMPRA" numero={oc.numero} />
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
            {oc.numero}
          </h1>
          <span className={`insignia no-imprimir ${COLOR_ESTADO[oc.estado]}`}>
            {ETIQUETA_ESTADO_OC[oc.estado]}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          Orden de compra · {oc.proveedor.razonSocial}
          {oc.proveedor.ruc ? ` (RUC ${oc.proveedor.ruc})` : ""} · Emitida el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(oc.fecha)} por{" "}
          {oc.usuarioNombre}
        </p>
        {oc.notas && <p className="text-sm text-neutral-500 mt-1">Notas: {oc.notas}</p>}
        {oc.estado === "ANULADA" && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Anulada. Motivo: {oc.motivoAnulacion}
          </p>
        )}

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Recibido</th>
              <th className="text-right">Costo unit.</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {oc.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.insumo.nombre}{" "}
                  <span className="text-xs text-neutral-400 font-mono">{d.insumo.codigo}</span>
                </td>
                <td className="text-right">
                  {formatNumero(d.cantidad, 2)} {d.insumo.unidadMedida}
                </td>
                <td className="text-right">{formatNumero(d.cantidadRecibida, 2)}</td>
                <td className="text-right">{formatMoneda(d.costoUnitario)}</td>
                <td className="text-right">{formatMoneda(d.subtotal)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="text-right font-semibold">
                Total
              </td>
              <td className="text-right font-semibold">{formatMoneda(oc.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {admiteRecepcion && pendientes.length > 0 && (
        <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Registrar recepción de mercadería
          </h2>
          <RecepcionFormulario ordenCompraId={oc.id} pendientes={pendientes} />
        </section>
      )}

      {oc.recepciones.length > 0 && (
        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Recepciones</h2>
          <div className="mt-2 flex flex-col gap-3">
            {oc.recepciones.map((r) => (
              <div key={r.id} className="border border-black/10 dark:border-white/10 rounded-lg p-3 text-sm">
                <p className="font-medium">
                  <span className="font-mono text-xs">{r.numero}</span> ·{" "}
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
                    r.fecha
                  )}{" "}
                  · {r.usuarioNombre}
                </p>
                <ul className="mt-1 text-neutral-500">
                  {r.detalles.map((rd) => (
                    <li key={rd.id}>
                      {rd.insumo.nombre}: {formatNumero(rd.cantidad, 2)} {rd.insumo.unidadMedida} a{" "}
                      {formatMoneda(rd.costoUnitario)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {oc.cuentasPorPagar.length > 0 && (
        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Cuentas por pagar generadas
          </h2>
          <ul className="mt-2 text-sm">
            {oc.cuentasPorPagar.map((cxp) => (
              <li key={cxp.id} className="py-1">
                <Link
                  href={`/finanzas/cuentas-por-pagar/${cxp.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {cxp.numeroDocumento}
                </Link>{" "}
                — {formatMoneda(cxp.total)} (saldo {formatMoneda(cxp.saldo)})
              </li>
            ))}
          </ul>
        </section>
      )}

      {oc.estado === "PENDIENTE" && oc.recepciones.length === 0 && (
        <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-red-700 dark:text-red-400 mb-3">Zona de anulación</h2>
          <AnularOCFormulario ordenCompraId={oc.id} />
        </section>
      )}
    </div>
  );
}
