import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PresupuestoFormulario from "../PresupuestoFormulario";
import { guardarPresupuesto } from "../actions";

const ETIQUETA_TIPO: Record<string, string> = {
  PRODUCCION: "Producción",
  VENTAS: "Ventas",
  ADMINISTRACION: "Administración",
  LOGISTICA: "Logística",
  OTRO: "Otro",
};

const NOMBRE_MES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default async function DetalleCentroCostoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hoy = new Date();

  const [centro, centros] = await Promise.all([
    prisma.centroCosto.findUnique({ where: { id }, include: { almacen: true } }),
    prisma.centroCosto.findMany({ orderBy: { codigo: "asc" } }),
  ]);
  if (!centro) notFound();

  // Últimos 12 períodos (mes actual incluido), más viejo primero.
  const periodos = Array.from({ length: 12 }, (_, i) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - (11 - i), 1);
    return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 };
  });

  const [presupuestos, real] = await Promise.all([
    prisma.presupuestoCentroCosto.findMany({ where: { centroCostoId: id } }),
    prisma.asientoDetalle.findMany({
      where: { centroCostoId: id },
      include: { asiento: true },
    }),
  ]);

  const presupuestoPorPeriodo = new Map(
    presupuestos.map((p) => [`${p.anio}-${p.mes}`, p.montoPresupuestado.toNumber()])
  );
  const realPorPeriodo = new Map<string, number>();
  for (const d of real) {
    const clave = `${d.asiento.anio}-${d.asiento.mes}`;
    const monto = d.debe.toNumber() - d.haber.toNumber();
    realPorPeriodo.set(clave, (realPorPeriodo.get(clave) ?? 0) + monto);
  }

  return (
    <div>
      <Link
        href="/finanzas/centros-costo"
        className="text-sm hover:underline"
        style={{ color: "var(--epicor-texto-tenue)" }}
      >
        ← Volver a centros de costo
      </Link>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/finanzas/centros-costo/nuevo"
        nuevoTexto="Nuevo centro de costo"
        registros={centros.map((c) => ({
          id: c.id,
          href: `/finanzas/centros-costo/${c.id}`,
          primario: c.nombre,
          secundario: c.codigo,
        }))}
      >
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {centro.nombre}
          </h1>
          <span
            className={`insignia ${
              centro.activo
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
            }`}
          >
            {centro.activo ? "Activo" : "Inactivo"}
          </span>
        </div>
        <p className="text-neutral-500 mt-1">
          {centro.codigo} · {ETIQUETA_TIPO[centro.tipo]}
          {centro.almacen ? ` · ${centro.almacen.nombre}` : ""}
        </p>

        <section className="mt-8 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Presupuestar un período
          </h2>
          <PresupuestoFormulario
            accion={guardarPresupuesto.bind(null, id)}
            mesActual={hoy.getMonth() + 1}
            anioActual={hoy.getFullYear()}
          />
        </section>

        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
            Presupuesto vs. real — últimos 12 meses
          </h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Período</th>
                <th className="text-right">Presupuestado</th>
                <th className="text-right">Real</th>
                <th className="text-right">Variación</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map(({ anio, mes }) => {
                const clave = `${anio}-${mes}`;
                const presupuestado = presupuestoPorPeriodo.get(clave) ?? 0;
                const montoReal = realPorPeriodo.get(clave) ?? 0;
                const variacion = montoReal - presupuestado;
                return (
                  <tr key={clave}>
                    <td>
                      {NOMBRE_MES[mes - 1]} {anio}
                    </td>
                    <td className="text-right">{formatMoneda(presupuestado)}</td>
                    <td className="text-right">{formatMoneda(montoReal)}</td>
                    <td
                      className={`text-right ${
                        variacion > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""
                      }`}
                    >
                      {formatMoneda(variacion)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
