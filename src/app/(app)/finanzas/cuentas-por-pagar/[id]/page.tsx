import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_MEDIO_PAGO, ETIQUETA_ESTADO_APROBACION } from "@/lib/etiquetas";
import { obtenerUsuario } from "@/lib/auth";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PagoFormulario from "./PagoFormulario";
import { aprobarPagoProveedor } from "../actions";
import RechazarPagoFormulario from "./RechazarPagoFormulario";

const COLOR_APROBACION: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  APROBADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADA: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function DetalleCuentaPorPagarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cuenta, cuentas, usuario] = await Promise.all([
    prisma.cuentaPorPagar.findUnique({
      where: { id },
      include: {
        proveedor: true,
        ordenCompra: true,
        pagos: { orderBy: { fecha: "asc" } },
      },
    }),
    prisma.cuentaPorPagar.findMany({ include: { proveedor: true }, orderBy: { fechaEmision: "desc" } }),
    obtenerUsuario(),
  ]);
  if (!cuenta) notFound();

  const puedeAprobar = usuario?.rol === "GERENCIA" || usuario?.rol === "ADMIN";

  return (
    <div>
      <Link href="/finanzas/cuentas-por-pagar" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a cuentas por pagar
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        registros={cuentas.map((c) => ({
          id: c.id,
          href: `/finanzas/cuentas-por-pagar/${c.id}`,
          primario: c.numeroDocumento,
          secundario: c.proveedor.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
      <div className="flex items-center gap-3 mt-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
          {cuenta.numeroDocumento}
        </h1>
        <span
          className={`insignia ${
            cuenta.estado === "PAGADA"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {cuenta.estado === "PAGADA" ? "Pagada" : "Pendiente"}
        </span>
      </div>
      <p className="text-neutral-500 mt-1">
        {cuenta.proveedor.razonSocial}
        {cuenta.ordenCompra && (
          <>
            {" "}
            · Orden{" "}
            <Link
              href={`/logistica/ordenes-compra/${cuenta.ordenCompra.id}`}
              className="font-mono text-sm hover:underline"
            >
              {cuenta.ordenCompra.numero}
            </Link>
          </>
        )}{" "}
        · Emitida el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(cuenta.fechaEmision)}
        {cuenta.fechaVencimiento &&
          ` · Vence el ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(cuenta.fechaVencimiento)}`}
      </p>

      <div className="grid grid-cols-2 gap-4 mt-6 max-w-md">
        <Dato etiqueta="Total" valor={formatMoneda(cuenta.total)} />
        <Dato etiqueta="Saldo por pagar" valor={formatMoneda(cuenta.saldo)} />
      </div>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Pagos realizados</h2>
        {cuenta.pagos.length > 0 ? (
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Medio</th>
                <th>Referencia</th>
                <th>Registrado por</th>
                <th className="text-right">Monto</th>
                <th>Aprobación</th>
              </tr>
            </thead>
            <tbody>
              {cuenta.pagos.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
                      p.fecha
                    )}
                  </td>
                  <td>{ETIQUETA_MEDIO_PAGO[p.medioPago]}</td>
                  <td className="text-sm text-neutral-500">{p.referencia ?? "—"}</td>
                  <td className="text-sm">{p.usuarioNombre}</td>
                  <td className="text-right">{formatMoneda(p.monto)}</td>
                  <td>
                    {p.estadoAprobacion === "NO_REQUERIDA" ? (
                      <span className="text-xs text-neutral-400">—</span>
                    ) : (
                      <span className={`insignia ${COLOR_APROBACION[p.estadoAprobacion]}`}>
                        {ETIQUETA_ESTADO_APROBACION[p.estadoAprobacion]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-neutral-500 mt-2">Sin pagos registrados.</p>
        )}

        {puedeAprobar &&
          cuenta.pagos
            .filter((p) => p.estadoAprobacion === "PENDIENTE")
            .map((p) => (
              <div
                key={p.id}
                className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 mt-4"
              >
                <p className="text-sm">
                  Pago de <span className="font-semibold">{formatMoneda(p.monto)}</span> pendiente de tu
                  aprobación (supera el monto configurado en Configuración → Empresa).
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <form
                    action={async () => {
                      "use server";
                      await aprobarPagoProveedor(p.id);
                    }}
                  >
                    <button type="submit" className="boton-primario text-sm px-3 py-1.5">
                      Aprobar pago
                    </button>
                  </form>
                  <RechazarPagoFormulario pagoId={p.id} />
                </div>
              </div>
            ))}

        {cuenta.saldo.toNumber() > 0 && (
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 mt-4">
            <PagoFormulario cuentaId={cuenta.id} saldo={cuenta.saldo.toNumber()} />
          </div>
        )}
      </section>
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
