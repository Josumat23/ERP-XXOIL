import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import { alternarActivoCentroCosto } from "./actions";

const ETIQUETA_TIPO: Record<string, string> = {
  PRODUCCION: "Producción",
  VENTAS: "Ventas",
  ADMINISTRACION: "Administración",
  LOGISTICA: "Logística",
  OTRO: "Otro",
};

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function CentrosCostoPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const hoy = new Date();
  const { anio: anioParam, mes: mesParam } = await searchParams;
  const anio = Number(anioParam) || hoy.getFullYear();
  const mes = Number(mesParam) || hoy.getMonth() + 1;

  const centros = await prisma.centroCosto.findMany({
    include: { almacen: true },
    orderBy: { codigo: "asc" },
  });

  const [presupuestos, agregadosReal] = await Promise.all([
    prisma.presupuestoCentroCosto.findMany({ where: { anio, mes } }),
    prisma.asientoDetalle.groupBy({
      by: ["centroCostoId"],
      where: { centroCostoId: { not: null }, asiento: { anio, mes } },
      _sum: { debe: true, haber: true },
    }),
  ]);

  const presupuestoPorCentro = new Map(presupuestos.map((p) => [p.centroCostoId, p.montoPresupuestado.toNumber()]));
  const realPorCentro = new Map(
    agregadosReal.map((a) => [
      a.centroCostoId!,
      (a._sum.debe?.toNumber() ?? 0) - (a._sum.haber?.toNumber() ?? 0),
    ])
  );

  const totalPresupuestado = centros.reduce((acc, c) => acc + (presupuestoPorCentro.get(c.id) ?? 0), 0);
  const totalReal = centros.reduce((acc, c) => acc + (realPorCentro.get(c.id) ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Centros de costo
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Contabilidad de gestión: presupuesto vs. real por centro. Independiente del plan de
            cuentas — el plan dice qué es el gasto, el centro dice dónde se originó.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/finanzas/centros-costo/reglas" className="boton-secundario">
            Reglas y asignación
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <form method="get" className="flex items-end gap-3 mb-6 no-imprimir">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Mes</span>
          <select name="mes" defaultValue={mes} className="campo-input">
            {NOMBRE_MES.map((n, i) => (
              <option key={i + 1} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Año</span>
          <input name="anio" type="number" defaultValue={anio} className="campo-input w-24" />
        </label>
        <button type="submit" className="boton-secundario">
          Ver período
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Dato etiqueta="Presupuestado del período" valor={formatMoneda(totalPresupuestado)} />
        <Dato etiqueta="Real del período" valor={formatMoneda(totalReal)} />
        <Dato
          etiqueta="Variación"
          valor={formatMoneda(totalReal - totalPresupuestado)}
          alerta={totalReal > totalPresupuestado}
        />
      </div>

      <PanelMaestroDetalle
        nuevoHref="/finanzas/centros-costo/nuevo"
        nuevoTexto="Nuevo centro de costo"
        registros={centros.map((c) => ({
          id: c.id,
          href: `/finanzas/centros-costo/${c.id}`,
          primario: c.nombre,
          secundario: c.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Almacén / planta</th>
            <th className="text-right">Presupuestado</th>
            <th className="text-right">Real</th>
            <th className="text-right">Variación</th>
            <th>Estado</th>
            <th className="no-imprimir"></th>
          </tr>
        </thead>
        <tbody>
          {centros.map((c) => {
            const presupuestado = presupuestoPorCentro.get(c.id) ?? 0;
            const real = realPorCentro.get(c.id) ?? 0;
            const variacion = real - presupuestado;
            return (
              <tr key={c.id}>
                <td className="font-mono text-xs">
                  <Link href={`/finanzas/centros-costo/${c.id}`} className="hover:underline">
                    {c.codigo}
                  </Link>
                </td>
                <td>{c.nombre}</td>
                <td>{ETIQUETA_TIPO[c.tipo]}</td>
                <td>{c.almacen?.nombre ?? "—"}</td>
                <td className="text-right">{formatMoneda(presupuestado)}</td>
                <td className="text-right">{formatMoneda(real)}</td>
                <td
                  className={`text-right ${
                    variacion > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""
                  }`}
                >
                  {formatMoneda(variacion)}
                </td>
                <td>
                  <span
                    className={`insignia ${
                      c.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right no-imprimir">
                  <form
                    action={async () => {
                      "use server";
                      await alternarActivoCentroCosto(c.id, !c.activo);
                    }}
                  >
                    <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                      {c.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          {centros.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-neutral-500 py-6">
                No hay centros de costo registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p
        className={`text-xl font-semibold mt-0.5 ${
          alerta ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
