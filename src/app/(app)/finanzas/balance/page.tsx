import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";

const ETIQUETA_TIPO: Record<string, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
  INGRESO: "Ingreso",
  GASTO: "Gasto",
};

// Balance de comprobación: suma de debe/haber por cuenta en el período,
// con saldo deudor o acreedor. Débitos totales = créditos totales siempre
// que los asientos estén cuadrados (el motor lo garantiza).
export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;

  const hoy = new Date();
  let anio = hoy.getFullYear();
  let mes = hoy.getMonth() + 1;
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [a, m] = mesParam.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      anio = a;
      mes = m;
    }
  }

  const detalles = await prisma.asientoDetalle.findMany({
    where: { asiento: { anio, mes } },
    include: { cuenta: true },
  });

  type Fila = { codigo: string; nombre: string; tipo: string; debe: number; haber: number };
  const porCuenta = new Map<string, Fila>();
  for (const d of detalles) {
    const fila = porCuenta.get(d.cuentaId) ?? {
      codigo: d.cuenta.codigo,
      nombre: d.cuenta.nombre,
      tipo: d.cuenta.tipo,
      debe: 0,
      haber: 0,
    };
    fila.debe += d.debe.toNumber();
    fila.haber += d.haber.toNumber();
    porCuenta.set(d.cuentaId, fila);
  }
  const filas = [...porCuenta.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totalDebe = filas.reduce((acc, f) => acc + f.debe, 0);
  const totalHaber = filas.reduce((acc, f) => acc + f.haber, 0);
  const cuadrado = Math.round(totalDebe * 100) === Math.round(totalHaber * 100);

  const mesAnterior = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
  const mesSiguiente = mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
  const nombreMes = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    new Date(anio, mes - 1, 1)
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between no-imprimir">
        <div className="flex items-center gap-2">
          <Link href={`/finanzas/balance?mes=${mesAnterior}`} className="boton-secundario px-2 py-1">
            ←
          </Link>
          <Link href={`/finanzas/balance?mes=${mesSiguiente}`} className="boton-secundario px-2 py-1">
            →
          </Link>
        </div>
        <BotonImprimir />
      </div>

      <div className="documento">
        <MembreteEmpresa soloImprimir tituloDocumento="BALANCE DE COMPROBACIÓN" />
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
          Balance de comprobación
        </h1>
        <p className="text-neutral-500 mt-1 capitalize">{nombreMes}</p>

        {!cuadrado && filas.length > 0 && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
            ⚠ El balance no cuadra: revise los asientos del período.
          </p>
        )}

        <table className="tabla tabla-densa mt-6">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th className="text-right">Debe</th>
              <th className="text-right">Haber</th>
              <th className="text-right">Saldo deudor</th>
              <th className="text-right">Saldo acreedor</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const saldo = f.debe - f.haber;
              return (
                <tr key={f.codigo}>
                  <td>
                    <span className="font-mono text-xs">{f.codigo}</span> {f.nombre}
                  </td>
                  <td className="text-neutral-500">{ETIQUETA_TIPO[f.tipo]}</td>
                  <td className="text-right">{formatMoneda(f.debe)}</td>
                  <td className="text-right">{formatMoneda(f.haber)}</td>
                  <td className="text-right">{saldo > 0 ? formatMoneda(saldo) : ""}</td>
                  <td className="text-right">{saldo < 0 ? formatMoneda(-saldo) : ""}</td>
                </tr>
              );
            })}
            {filas.length > 0 && (
              <tr className={cuadrado ? "bg-green-500/10" : "bg-red-500/10"}>
                <td colSpan={2} className="font-semibold">
                  Totales {cuadrado ? "✓" : "✗"}
                </td>
                <td className="text-right font-semibold">{formatMoneda(totalDebe)}</td>
                <td className="text-right font-semibold">{formatMoneda(totalHaber)}</td>
                <td colSpan={2}></td>
              </tr>
            )}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-6">
                  Sin movimientos contables en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
