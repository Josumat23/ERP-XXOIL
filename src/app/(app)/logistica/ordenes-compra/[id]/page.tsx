import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda, formatNumero, formatFecha } from "@/lib/format";
import { ETIQUETA_ESTADO_OC, ETIQUETA_ESTADO_APROBACION } from "@/lib/etiquetas";
import { obtenerUsuario } from "@/lib/auth";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import RecepcionFormulario from "./RecepcionFormulario";
import AnularOCFormulario from "./AnularOCFormulario";
import RechazarOCFormulario from "./RechazarOCFormulario";
import { aprobarOrdenCompra } from "../actions";

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PARCIAL: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  RECIBIDA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

const COLOR_APROBACION: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function DetalleOrdenCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [oc, ordenes, usuario] = await Promise.all([
    prisma.ordenCompra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        almacen: true,
        detalles: { include: { insumo: true } },
        recepciones: {
          include: { detalles: { include: { insumo: true, inspeccion: true } } },
          orderBy: { fecha: "asc" },
        },
        cuentasPorPagar: true,
      },
    }),
    prisma.ordenCompra.findMany({ include: { proveedor: true }, orderBy: { fecha: "desc" } }),
    obtenerUsuario(),
  ]);
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

  const puedeAprobar = usuario?.rol === "GERENCIA" || usuario?.rol === "ADMIN";
  const admiteRecepcion =
    (oc.estado === "PENDIENTE" || oc.estado === "PARCIAL") &&
    oc.estadoAprobacion !== "PENDIENTE" &&
    oc.estadoAprobacion !== "RECHAZADA";

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href="/logistica/ordenes-compra" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a órdenes de compra
        </Link>
        <BotonImprimir />
      </div>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/logistica/ordenes-compra/nuevo"
        nuevoTexto="Nueva orden"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/logistica/ordenes-compra/${o.id}`,
          primario: o.numero,
          secundario: o.proveedor.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
      <div className="documento">
        <MembreteEmpresa soloImprimir tituloDocumento="ORDEN DE COMPRA" numero={oc.numero} />
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
            {oc.numero}
          </h1>
          <span className={`insignia no-imprimir ${COLOR_ESTADO[oc.estado]}`}>
            {ETIQUETA_ESTADO_OC[oc.estado]}
          </span>
          {oc.estadoAprobacion !== "NO_REQUERIDA" && (
            <span className={`insignia no-imprimir ${COLOR_APROBACION[oc.estadoAprobacion]}`}>
              {ETIQUETA_ESTADO_APROBACION[oc.estadoAprobacion]}
            </span>
          )}
        </div>
        <p className="text-neutral-500 mt-1">
          Orden de compra · {oc.proveedor.razonSocial}
          {oc.proveedor.ruc ? ` (RUC ${oc.proveedor.ruc})` : ""} · Emitida el{" "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(oc.fecha)} por{" "}
          {oc.usuarioNombre} · Moneda {oc.moneda}
          {oc.moneda !== "PEN" ? ` (T.C. ${oc.tipoCambio.toFixed(3)})` : ""}
          {oc.almacen ? ` · Destino: ${oc.almacen.nombre}` : ""}
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
              <th>Entrega esperada</th>
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
                <td className="text-right">{formatMoneda(d.costoUnitario, oc.moneda)}</td>
                <td className="text-right">{formatMoneda(d.subtotal, oc.moneda)}</td>
                <td className="text-sm text-neutral-500">
                  {d.fechaEntregaEsperada ? formatFecha(d.fechaEntregaEsperada) : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="text-right font-semibold">
                Total
              </td>
              <td className="text-right font-semibold">{formatMoneda(oc.total, oc.moneda)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        {oc.moneda !== "PEN" && (
          <p className="text-xs text-neutral-500 mt-1">
            ≈ {formatMoneda(oc.total.toNumber() * oc.tipoCambio.toNumber())} al tipo de cambio de la
            orden
          </p>
        )}
      </div>

      {oc.estadoAprobacion === "PENDIENTE" && (
        <section className="mt-8 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
            Pendiente de aprobación
          </h2>
          <p className="text-sm text-neutral-500 mb-3">
            Esta orden ({formatMoneda(oc.total.toNumber() * oc.tipoCambio.toNumber())}) supera el
            monto configurado en Configuración → Empresa y no se puede recepcionar hasta que Gerencia
            la apruebe.
          </p>
          {puedeAprobar ? (
            <div className="flex flex-wrap items-center gap-3">
              <form
                action={async () => {
                  "use server";
                  await aprobarOrdenCompra(oc.id);
                }}
              >
                <button type="submit" className="boton-primario text-sm px-3 py-1.5">
                  Aprobar orden
                </button>
              </form>
              <RechazarOCFormulario ordenCompraId={oc.id} />
            </div>
          ) : (
            <p className="text-xs text-neutral-400">Solo Gerencia o un Administrador puede resolverla.</p>
          )}
        </section>
      )}
      {oc.estadoAprobacion === "RECHAZADA" && (
        <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-red-700 dark:text-red-400 mb-1">Rechazada por Gerencia</h2>
          <p className="text-sm text-neutral-500">
            {oc.motivoRechazo} — {oc.aprobadaPor} el{" "}
            {oc.aprobadaEn && new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(oc.aprobadaEn)}
          </p>
        </section>
      )}

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
                      {formatMoneda(rd.costoUnitario, oc.moneda)}
                      {rd.inspeccion && (
                        <Link
                          href={`/logistica/inspeccion-compras/${rd.inspeccion.id}`}
                          className={`insignia ml-2 no-imprimir ${
                            rd.inspeccion.resultado === "PENDIENTE"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                              : rd.inspeccion.resultado === "APROBADO"
                                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                          }`}
                        >
                          {rd.inspeccion.resultado === "PENDIENTE"
                            ? "Pendiente de inspección"
                            : rd.inspeccion.resultado === "APROBADO"
                              ? "Inspección aprobada"
                              : "Inspección rechazada"}
                        </Link>
                      )}
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
                {cxp.montoOriginal && cxp.monedaOriginal && (
                  <span className="text-neutral-400">
                    {" "}
                    · {formatMoneda(cxp.montoOriginal, cxp.monedaOriginal)} original
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 no-imprimir">
        <PanelAdjuntos
          entidadTipo="OrdenCompra"
          entidadId={oc.id}
          rutaRevalidar={`/logistica/ordenes-compra/${oc.id}`}
        />
      </div>

      {oc.estado === "PENDIENTE" && oc.recepciones.length === 0 && (
        <section className="mt-8 border border-red-200 dark:border-red-900 rounded-lg p-4 no-imprimir">
          <h2 className="font-medium text-red-700 dark:text-red-400 mb-3">Zona de anulación</h2>
          <AnularOCFormulario ordenCompraId={oc.id} />
        </section>
      )}
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
