import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function DetallePlanillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const periodo = await prisma.planillaPeriodo.findUnique({
    where: { id },
    include: { detalles: { include: { empleado: true }, orderBy: { empleado: { codigo: "asc" } } } },
  });
  if (!periodo) notFound();

  const fechaPeriodo = new Date(periodo.anio, periodo.mes - 1, 1);
  const idsIncluidos = periodo.detalles.map((d) => d.empleadoId);
  const excluidos = await prisma.empleado.findMany({
    where: {
      estado: "ACTIVO",
      tipoContrato: { not: "LOCACION_SERVICIOS" },
      id: { notIn: idsIncluidos.length > 0 ? idsIncluidos : undefined },
    },
  });

  const totales = periodo.detalles.reduce(
    (acc, d) => ({
      remuneracionComputable: acc.remuneracionComputable + d.remuneracionComputable.toNumber(),
      descuentoPension: acc.descuentoPension + d.descuentoPension.toNumber(),
      essaludPatronal: acc.essaludPatronal + d.essaludPatronal.toNumber(),
      retencion5ta: acc.retencion5ta + d.retencion5ta.toNumber(),
      neto: acc.neto + d.neto.toNumber(),
    }),
    { remuneracionComputable: 0, descuentoPension: 0, essaludPatronal: 0, retencion5ta: 0, neto: 0 }
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-imprimir">
        <Link href="/rrhh/planilla" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a planilla
        </Link>
        <BotonImprimir />
      </div>

      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Planilla {NOMBRE_MES[periodo.mes - 1]} {periodo.anio}
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Generada por {periodo.usuarioNombre} el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(periodo.creadoEn)}
        {periodo.detalles[0]?.asientoNumero && ` — asiento contable ${periodo.detalles[0].asientoNumero}`}
      </p>

      {excluidos.length > 0 && (
        <div className="mb-6 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-4 no-imprimir">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
            {excluidos.length} empleado(s) activo(s) excluido(s) de esta corrida
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-500">
            No tienen sistema de pensión (o AFP) configurado. Complételo en su ficha y regenere la
            planilla si corresponde:{" "}
            {excluidos.map((e, i) => (
              <span key={e.id}>
                {i > 0 && ", "}
                <Link href={`/rrhh/empleados/${e.id}`} className="hover:underline">
                  {e.nombres} {e.apellidos}
                </Link>
              </span>
            ))}
            .
          </p>
        </div>
      )}

      <table className="tabla">
        <thead>
          <tr>
            <th>Empleado</th>
            <th className="text-right">Básico</th>
            <th className="text-right">Asig. familiar</th>
            <th className="text-right">Bruto</th>
            <th className="text-right">Pensión</th>
            <th className="text-right">5ta cat.</th>
            <th className="text-right">Neto</th>
            <th className="no-imprimir"></th>
          </tr>
        </thead>
        <tbody>
          {periodo.detalles.map((d) => (
            <tr key={d.id}>
              <td>
                {d.empleado.nombres} {d.empleado.apellidos}
              </td>
              <td className="text-right">{formatMoneda(d.sueldoBasico)}</td>
              <td className="text-right">{formatMoneda(d.asignacionFamiliar)}</td>
              <td className="text-right">{formatMoneda(d.remuneracionComputable)}</td>
              <td className="text-right text-red-600 dark:text-red-400">
                -{formatMoneda(d.descuentoPension)}
              </td>
              <td className="text-right text-red-600 dark:text-red-400">
                -{formatMoneda(d.retencion5ta)}
              </td>
              <td className="text-right font-medium">{formatMoneda(d.neto)}</td>
              <td className="text-right no-imprimir">
                <Link href={`/rrhh/planilla/${periodo.id}/${d.id}`} className="text-neutral-600 dark:text-neutral-400 hover:underline">
                  Boleta
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td>Total</td>
            <td></td>
            <td></td>
            <td className="text-right">{formatMoneda(totales.remuneracionComputable)}</td>
            <td className="text-right">-{formatMoneda(totales.descuentoPension)}</td>
            <td className="text-right">-{formatMoneda(totales.retencion5ta)}</td>
            <td className="text-right">{formatMoneda(totales.neto)}</td>
            <td className="no-imprimir"></td>
          </tr>
        </tfoot>
      </table>

      <p className="text-xs text-neutral-400 mt-4">
        Gasto patronal EsSalud del período (no descontado al trabajador): {formatMoneda(totales.essaludPatronal)}.
        Fecha de referencia para las tasas: {new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(fechaPeriodo)}.
      </p>
    </div>
  );
}
