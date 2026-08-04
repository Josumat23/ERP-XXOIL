import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ETIQUETA_TIPO: Record<string, string> = {
  MENSUAL: "BOLETA DE PAGO",
  GRATIFICACION_JULIO: "GRATIFICACIÓN — JULIO",
  GRATIFICACION_DICIEMBRE: "GRATIFICACIÓN — DICIEMBRE",
  CTS_MAYO: "CTS — MAYO",
  CTS_NOVIEMBRE: "CTS — NOVIEMBRE",
};

export default async function BoletaPagoPage({
  params,
}: {
  params: Promise<{ id: string; detalleId: string }>;
}) {
  const { id, detalleId } = await params;

  const detalle = await prisma.planillaDetalle.findUnique({
    where: { id: detalleId },
    include: { empleado: true, planillaPeriodo: true },
  });
  if (!detalle || detalle.planillaPeriodoId !== id) notFound();

  const p = detalle.planillaPeriodo;
  const esMensual = p.tipo === "MENSUAL";
  const esGratificacion = p.tipo === "GRATIFICACION_JULIO" || p.tipo === "GRATIFICACION_DICIEMBRE";
  const esCts = p.tipo === "CTS_MAYO" || p.tipo === "CTS_NOVIEMBRE";

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir">
        <Link href={`/rrhh/planilla/${id}`} className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
          ← Volver a la planilla
        </Link>
        <BotonImprimir />
      </div>

      <div className="max-w-2xl">
        <div className="documento border border-black/10 dark:border-white/10 rounded-lg p-6 mt-4">
          <MembreteEmpresa
            tituloDocumento={ETIQUETA_TIPO[p.tipo] ?? "BOLETA DE PAGO"}
            numero={`${NOMBRE_MES[p.mes - 1]} ${p.anio}`}
          />

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
            <Dato etiqueta="Trabajador" valor={`${detalle.empleado.nombres} ${detalle.empleado.apellidos}`} />
            <Dato etiqueta="Código" valor={detalle.empleado.codigo} />
            <Dato etiqueta="Cargo" valor={detalle.empleado.cargo} />
            <Dato etiqueta="Área" valor={detalle.empleado.area} />
            <Dato etiqueta="Período" valor={`${NOMBRE_MES[p.mes - 1]} ${p.anio}`} />
            {esMensual && <Dato etiqueta="Sistema de pensión" valor={detalle.detallePension || "—"} />}
            {!esMensual && (
              <Dato etiqueta="Meses computados" valor={detalle.mesesComputados?.toString() ?? "—"} />
            )}
          </div>

          <table className="tabla mt-6">
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="text-right">Ingreso</th>
                <th className="text-right">Descuento</th>
              </tr>
            </thead>
            <tbody>
              {esMensual ? (
                <>
                  <tr>
                    <td>Remuneración básica</td>
                    <td className="text-right">{formatMoneda(detalle.sueldoBasico)}</td>
                    <td className="text-right">—</td>
                  </tr>
                  {detalle.asignacionFamiliar.toNumber() > 0 && (
                    <tr>
                      <td>Asignación familiar</td>
                      <td className="text-right">{formatMoneda(detalle.asignacionFamiliar)}</td>
                      <td className="text-right">—</td>
                    </tr>
                  )}
                  <tr>
                    <td>{detalle.detallePension || "Pensión"}</td>
                    <td className="text-right">—</td>
                    <td className="text-right">{formatMoneda(detalle.descuentoPension)}</td>
                  </tr>
                  {detalle.retencion5ta.toNumber() > 0 && (
                    <tr>
                      <td>Retención renta de 5ta categoría</td>
                      <td className="text-right">—</td>
                      <td className="text-right">{formatMoneda(detalle.retencion5ta)}</td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  <tr>
                    <td>{esGratificacion ? "Gratificación (base)" : "CTS"}</td>
                    <td className="text-right">{formatMoneda(detalle.remuneracionComputable)}</td>
                    <td className="text-right">—</td>
                  </tr>
                  {esGratificacion && detalle.bonificacionExtraordinaria.toNumber() > 0 && (
                    <tr>
                      <td>Bonificación extraordinaria (Ley 30334)</td>
                      <td className="text-right">{formatMoneda(detalle.bonificacionExtraordinaria)}</td>
                      <td className="text-right">—</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>{esCts ? "Depósito CTS" : "Neto a pagar"}</td>
                <td className="text-right" colSpan={2}>
                  {formatMoneda(detalle.neto)}
                </td>
              </tr>
            </tfoot>
          </table>

          {esMensual && (
            <p className="text-xs text-neutral-400 mt-6">
              Aporte EsSalud del empleador (informativo, no se descuenta del trabajador):{" "}
              {formatMoneda(detalle.essaludPatronal)}.
            </p>
          )}
          {!esCts && detalle.empleado.banco && (
            <p className="text-xs text-neutral-400 mt-1">
              Abono a: {detalle.empleado.banco} — cuenta {detalle.empleado.numeroCuenta ?? "—"}
              {detalle.empleado.cci && ` (CCI ${detalle.empleado.cci})`}.
            </p>
          )}
          {esCts && (
            <p className="text-xs text-neutral-400 mt-1">
              Se deposita en la cuenta CTS del trabajador en la entidad financiera que él eligió — no
              se transfiere a su cuenta de haberes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <p>
      <span className="text-neutral-500">{etiqueta}: </span>
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{valor}</span>
    </p>
  );
}
