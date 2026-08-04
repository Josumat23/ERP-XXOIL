import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PlanillaFormulario from "./PlanillaFormulario";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function PlanillaPage() {
  const periodos = await prisma.planillaPeriodo.findMany({
    include: { detalles: true },
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Planilla
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Cálculo mensual de sueldos con aportes legales (EsSalud, ONP/AFP, retención de 5ta
            categoría). Fase 1 — gratificaciones, CTS y liquidación de desvinculación quedan para una
            siguiente iteración.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/rrhh/planilla/parametros" className="boton-secundario">
            Parámetros
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <div className="mb-6 no-imprimir">
        <PlanillaFormulario />
      </div>

      <table className="tabla">
        <thead>
          <tr>
            <th>Período</th>
            <th>Estado</th>
            <th className="text-right">Empleados</th>
            <th className="text-right">Neto total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => {
            const netoTotal = p.detalles.reduce((acc, d) => acc + d.neto.toNumber(), 0);
            return (
              <tr key={p.id}>
                <td>
                  <Link href={`/rrhh/planilla/${p.id}`} className="hover:underline">
                    {NOMBRE_MES[p.mes - 1]} {p.anio}
                  </Link>
                </td>
                <td>
                  <span
                    className={`insignia ${
                      p.estado === "CERRADO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {p.estado === "CERRADO" ? "Cerrado" : "Abierto"}
                  </span>
                </td>
                <td className="text-right">{p.detalles.length}</td>
                <td className="text-right">{formatMoneda(netoTotal)}</td>
                <td className="text-right">
                  <Link href={`/rrhh/planilla/${p.id}`} className="text-neutral-600 dark:text-neutral-400 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
          {periodos.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-neutral-500 py-6">
                No hay planillas generadas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
