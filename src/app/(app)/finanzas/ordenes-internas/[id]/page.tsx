import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import AgregarCostoFormulario from "../AgregarCostoFormulario";
import LiquidarFormulario from "../LiquidarFormulario";
import { agregarCostoOrdenInterna, anularOrdenInterna, liquidarOrdenInterna } from "../actions";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTA: "Abierta",
  LIQUIDADA: "Liquidada",
  ANULADA: "Anulada",
};

const CLASE_ESTADO: Record<string, string> = {
  ABIERTA: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  LIQUIDADA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  ANULADA: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

export default async function DetalleOrdenInternaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const { id } = await params;

  const [orden, ordenes, centrosCosto] = await Promise.all([
    prisma.ordenInterna.findUnique({
      where: { id },
      include: {
        centroCosto: true,
        costos: { orderBy: { fecha: "desc" } },
      },
    }),
    prisma.ordenInterna.findMany({ orderBy: { creadoEn: "desc" } }),
    prisma.centroCosto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!orden) notFound();

  const totalAcumulado = orden.totalAcumulado.toNumber();
  const presupuesto = orden.presupuesto?.toNumber() ?? null;
  const excedePresupuesto = presupuesto !== null && totalAcumulado > presupuesto;

  return (
    <div>
      <Link
        href="/finanzas/ordenes-internas"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a órdenes internas
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/finanzas/ordenes-internas/nueva"
        nuevoTexto="Nueva orden interna"
        registros={ordenes.map((o) => ({
          id: o.id,
          href: `/finanzas/ordenes-internas/${o.id}`,
          primario: o.codigo,
          secundario: o.descripcion,
        }))}
      >
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
              {orden.codigo} — {orden.descripcion}
            </h1>
            <span className={`insignia ${CLASE_ESTADO[orden.estado]}`}>
              {ETIQUETA_ESTADO[orden.estado]}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
            Creada por {orden.usuarioNombre} el{" "}
            {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(orden.fechaInicio)}
            {orden.centroCosto ? ` · Destino sugerido: ${orden.centroCosto.nombre}` : ""}
            {orden.fechaLiquidacion
              ? ` · Liquidada el ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(orden.fechaLiquidacion)}`
              : ""}
          </p>

          <div className="grid grid-cols-2 gap-4 mt-4 max-w-md">
            <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
              <p className="text-xs text-neutral-500">Acumulado</p>
              <p
                className={`text-xl font-semibold mt-0.5 ${
                  excedePresupuesto
                    ? "text-red-600 dark:text-red-400"
                    : "text-neutral-900 dark:text-neutral-100"
                }`}
              >
                {formatMoneda(totalAcumulado)}
              </p>
            </div>
            <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
              <p className="text-xs text-neutral-500">Presupuesto (informativo)</p>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                {presupuesto !== null ? formatMoneda(presupuesto) : "—"}
              </p>
            </div>
          </div>
          {excedePresupuesto && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              El acumulado ya superó el presupuesto informativo. Esto no bloquea nada, solo alerta.
            </p>
          )}

          <table className="tabla mt-6">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Registrado por</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {orden.costos.map((c) => (
                <tr key={c.id}>
                  <td className="text-sm">
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(c.fecha)}
                  </td>
                  <td>{c.concepto}</td>
                  <td className="text-sm text-neutral-500">{c.usuarioNombre}</td>
                  <td className="text-right">{formatMoneda(c.monto.toNumber())}</td>
                </tr>
              ))}
              {orden.costos.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-500 py-4">
                    Todavía no se cargó ningún costo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {orden.estado === "ABIERTA" && (
            <>
              <section className="mt-6">
                <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
                  Agregar costo
                </h2>
                <AgregarCostoFormulario accion={agregarCostoOrdenInterna.bind(null, orden.id)} />
              </section>

              <section className="mt-6">
                <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
                  Liquidar
                </h2>
                <p className="text-xs text-neutral-500 mb-2">
                  Contabiliza el acumulado en un solo asiento contra el centro de costo elegido y
                  cierra la orden.
                </p>
                {totalAcumulado > 0 ? (
                  <LiquidarFormulario
                    accion={liquidarOrdenInterna.bind(null, orden.id)}
                    centrosCosto={centrosCosto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} — ${c.nombre}` }))}
                    centroCostoSugeridoId={orden.centroCostoId}
                    totalAcumulado={totalAcumulado}
                  />
                ) : (
                  <p className="text-sm text-neutral-500">
                    Agregue al menos un costo antes de poder liquidar.
                  </p>
                )}
              </section>

              {totalAcumulado === 0 && (
                <form
                  className="mt-6"
                  action={async () => {
                    "use server";
                    await anularOrdenInterna(orden.id);
                  }}
                >
                  <button type="submit" className="boton-secundario text-sm">
                    Anular orden (sin costos)
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </PanelMaestroDetalle>
    </div>
  );
}
