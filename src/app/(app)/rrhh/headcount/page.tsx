import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

type Fila = { area: string; headcount: number; costoMensual: number };

export default async function HeadcountPage() {
  const empleados = await prisma.empleado.findMany({
    where: { estado: "ACTIVO" },
    orderBy: { area: "asc" },
  });

  const mapa = new Map<string, Fila>();
  for (const e of empleados) {
    const fila = mapa.get(e.area) ?? { area: e.area, headcount: 0, costoMensual: 0 };
    fila.headcount++;
    fila.costoMensual += e.sueldoBasico.toNumber();
    mapa.set(e.area, fila);
  }

  const filas = Array.from(mapa.values()).sort((a, b) => b.costoMensual - a.costoMensual);
  const totalHeadcount = filas.reduce((acc, f) => acc + f.headcount, 0);
  const totalCosto = filas.reduce((acc, f) => acc + f.costoMensual, 0);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Headcount y costo de personal por área
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Trabajadores activos y su sueldo básico mensual, agrupados por área. El costo real de
        planilla (con EsSalud, ONP/AFP y demás) se ve en Recursos Humanos → Planilla; esto es una
        vista rápida de dotación y costo base.
      </p>

      <div className="grid grid-cols-2 gap-4 mt-6 max-w-md">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Trabajadores activos</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {totalHeadcount}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Costo base mensual</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatMoneda(totalCosto)}
          </p>
        </div>
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Área</th>
            <th className="text-right">Headcount</th>
            <th className="text-right">Costo base mensual</th>
            <th className="text-right">% del total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.area}>
              <td>{f.area}</td>
              <td className="text-right">{f.headcount}</td>
              <td className="text-right font-medium">{formatMoneda(f.costoMensual)}</td>
              <td className="text-right text-neutral-500">
                {totalCosto > 0 ? `${((f.costoMensual / totalCosto) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-neutral-500 py-6">
                No hay empleados activos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
