import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha } from "@/lib/format";
import { InspeccionDevolucionFormulario } from "../../comercial/facturas/[id]/FormulariosFactura";

const COLOR_ESTADO = {
  PENDIENTE_INSPECCION: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  CERRADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
} as const;

export default async function DevolucionesClientePage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const puedeInspeccionar = await puedeRealizar(usuario, "materiales", "editar");

  const devoluciones = await prisma.devolucionCliente.findMany({
    include: {
      factura: { include: { cliente: true } },
      almacen: true,
      detalles: {
        include: {
          facturaDetalle: {
            include: { presentacion: { include: { producto: true } } },
          },
          notasCreditoDetalle: true,
        },
      },
    },
    orderBy: [{ estado: "asc" }, { fechaRecepcion: "desc" }],
  });

  return (
    <div className="max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Devoluciones de clientes
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Bandeja operativa de recepción bloqueada, inspección y disposición. El material no aumenta
          el stock disponible hasta que Calidad aprueba su reingreso.
        </p>
      </div>

      <div className="space-y-4">
        {devoluciones.map((devolucion) => (
          <article key={devolucion.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{devolucion.numero}</p>
                <p className="text-sm">{devolucion.factura.cliente.razonSocial}</p>
                <p className="text-xs text-neutral-500">
                  Factura {devolucion.factura.numero} · {formatFecha(devolucion.fechaRecepcion)} ·
                  Almacén {devolucion.almacen.codigo}
                </p>
              </div>
              <span className={'insignia ' + COLOR_ESTADO[devolucion.estado]}>
                {devolucion.estado === "CERRADA" ? "Inspección cerrada" : "Pendiente de inspección"}
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{devolucion.motivo}</p>

            <div className="mt-3 space-y-3">
              {devolucion.detalles.map((detalle) => {
                const acreditado = detalle.notasCreditoDetalle.reduce(
                  (total, linea) => total + linea.cantidad.toNumber(),
                  0
                );
                return (
                  <div key={detalle.id} className="border-t border-black/5 pt-3 dark:border-white/5">
                    <div className="grid gap-2 text-sm md:grid-cols-7">
                      <div className="md:col-span-2">
                        <p className="font-medium">
                          {detalle.facturaDetalle.presentacion.producto.nombre} — {detalle.facturaDetalle.presentacion.nombre}
                        </p>
                        <p className="text-xs text-neutral-500">Recibido: {detalle.cantidad}</p>
                      </div>
                      <Dato etiqueta="Decisión" valor={etiquetaDecision(detalle.decision)} />
                      <Dato etiqueta="Reingreso" valor={detalle.cantidadReingreso} />
                      <Dato etiqueta="Desecho" valor={detalle.cantidadDesecho} />
                      <Dato etiqueta="Al cliente" valor={detalle.cantidadDevolverCliente} />
                      <Dato etiqueta="Compensable / NC" valor={detalle.cantidadAcreditable + " / " + acreditado} />
                    </div>
                    {detalle.observacionCalidad && (
                      <p className="mt-2 text-xs text-neutral-500">Calidad: {detalle.observacionCalidad}</p>
                    )}
                    {detalle.decision === "PENDIENTE" && puedeInspeccionar && (
                      <InspeccionDevolucionFormulario detalleId={detalle.id} cantidad={detalle.cantidad} />
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        {devoluciones.length === 0 && (
          <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-neutral-500 dark:border-white/15">
            No hay devoluciones de clientes registradas.
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}

function etiquetaDecision(decision: "PENDIENTE" | "REINGRESO_STOCK" | "DESECHO" | "DEVOLVER_CLIENTE" | "MIXTA") {
  return {
    PENDIENTE: "Pendiente",
    REINGRESO_STOCK: "Reingreso",
    DESECHO: "Desecho",
    DEVOLVER_CLIENTE: "Retorno",
    MIXTA: "Mixta",
  }[decision];
}
