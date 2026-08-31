import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha, formatMoneda } from "@/lib/format";
import { ETIQUETA_ESTADO_APROBACION, ETIQUETA_MEDIO_PAGO } from "@/lib/etiquetas";
import {
  OperacionesCreditoFormulario,
  RechazarReembolsoFormulario,
} from "./FormulariosCredito";
import { aprobarReembolso } from "./actions";

const COLOR_ESTADO = {
  DISPONIBLE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  AGOTADO: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export default async function SaldosFavorClientesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const [puedeEditar, puedeAprobar] = await Promise.all([
    puedeRealizar(usuario, "finanzas", "editar"),
    puedeRealizar(usuario, "finanzas", "aprobar"),
  ]);

  const [creditos, facturasPendientes] = await Promise.all([
    prisma.creditoCliente.findMany({
      include: {
        cliente: true,
        notaCredito: { include: { factura: true } },
        aplicaciones: { include: { factura: true }, orderBy: { fecha: "desc" } },
        reembolsos: { orderBy: { fecha: "desc" } },
      },
      orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    }),
    prisma.factura.findMany({
      where: { estado: "PENDIENTE", saldo: { gt: 0 } },
      select: { id: true, clienteId: true, moneda: true, numero: true, saldo: true },
      orderBy: { fechaEmision: "asc" },
    }),
  ]);

  const totalDisponibleFuncional = creditos
    .filter((credito) => credito.estado === "DISPONIBLE")
    .reduce((total, credito) => total + credito.saldoFuncional.toNumber(), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Saldos a favor de clientes
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Subledger originado por notas de crédito: compensación de CxC o reembolso controlado.
          </p>
        </div>
        <div className="rounded-lg border border-black/10 px-4 py-3 text-right dark:border-white/10">
          <p className="text-xs text-neutral-500">Pasivo disponible (funcional)</p>
          <p className="text-xl font-semibold">{formatMoneda(totalDisponibleFuncional)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {creditos.map((credito) => {
          const pendiente = credito.reembolsos.find(
            (reembolso) => reembolso.estadoAprobacion === "PENDIENTE"
          );
          const facturas = facturasPendientes
            .filter(
              (factura) =>
                factura.clienteId === credito.clienteId &&
                factura.moneda === credito.moneda
            )
            .map((factura) => ({
              id: factura.id,
              numero: factura.numero,
              saldo: factura.saldo.toNumber(),
            }));
          return (
            <article key={credito.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{credito.cliente.razonSocial}</p>
                  <p className="font-mono text-xs text-neutral-500">
                    NC {credito.notaCredito.numero} · factura origen {credito.notaCredito.factura.numero}
                  </p>
                  <p className="text-xs text-neutral-500">{formatFecha(credito.creadoEn)}</p>
                </div>
                <div className="text-right">
                  <span className={"insignia " + COLOR_ESTADO[credito.estado]}>
                    {credito.estado === "DISPONIBLE" ? "Disponible" : "Agotado"}
                  </span>
                  <p className="mt-2 text-lg font-semibold">
                    {credito.saldo.toNumber().toFixed(2) + " " + credito.moneda}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Origen {credito.montoOriginal.toNumber().toFixed(2)} · funcional {formatMoneda(credito.saldoFuncional)}
                  </p>
                </div>
              </div>

              {credito.estado === "DISPONIBLE" && puedeEditar && !pendiente && (
                <OperacionesCreditoFormulario
                  creditoId={credito.id}
                  saldo={credito.saldo.toNumber()}
                  moneda={credito.moneda}
                  facturas={facturas}
                />
              )}

              {credito.aplicaciones.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Compensaciones</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    {credito.aplicaciones.map((aplicacion) => (
                      <p key={aplicacion.id}>
                        {formatFecha(aplicacion.fecha) + " · factura " + aplicacion.factura.numero +
                          " · " + aplicacion.monto.toNumber().toFixed(2) + " " + credito.moneda}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {credito.reembolsos.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Reembolsos</h3>
                  {credito.reembolsos.map((reembolso) => (
                    <div key={reembolso.id} className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                          {reembolso.monto.toNumber().toFixed(2) + " " + reembolso.moneda +
                            " · " + ETIQUETA_MEDIO_PAGO[reembolso.medioPago]}
                        </p>
                        <span className="insignia bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {ETIQUETA_ESTADO_APROBACION[reembolso.estadoAprobacion]}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        Solicitó {reembolso.usuarioNombre} · referencia {reembolso.referencia ?? "—"}
                      </p>
                      {reembolso.motivoRechazo && (
                        <p className="mt-1 text-xs text-red-600">Rechazo: {reembolso.motivoRechazo}</p>
                      )}
                      {reembolso.estadoAprobacion === "PENDIENTE" && reembolso.usuarioId === usuario.id && (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          Espera la resolución de otra persona autorizada.
                        </p>
                      )}
                      {reembolso.estadoAprobacion === "PENDIENTE" && puedeAprobar && reembolso.usuarioId !== usuario.id && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <form
                            action={async () => {
                              "use server";
                              await aprobarReembolso(reembolso.id);
                            }}
                          >
                            <button type="submit" className="boton-primario text-sm">
                              Aprobar y pagar
                            </button>
                          </form>
                          <RechazarReembolsoFormulario reembolsoId={reembolso.id} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}

        {creditos.length === 0 && (
          <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-neutral-500 dark:border-white/15">
            No existen saldos a favor. Se crearán automáticamente cuando una nota de crédito exceda la CxC abierta.
          </div>
        )}
      </div>
    </div>
  );
}