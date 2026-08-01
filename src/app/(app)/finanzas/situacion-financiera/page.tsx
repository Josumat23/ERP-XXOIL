import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import MembreteEmpresa from "@/components/MembreteEmpresa";

// Estado de Situación Financiera (Balance Sheet): saldos acumulados de las
// cuentas de Activo/Pasivo/Patrimonio desde el inicio hasta el fin del mes
// elegido, leídos directamente del libro mayor (AsientoDetalle) — no de un
// cálculo aparte. El resultado del ejercicio (Ingresos − Gastos acumulados,
// ya que este sistema no hace asientos de cierre de período) se suma al
// Patrimonio para que Activo = Pasivo + Patrimonio siempre cuadre.
//
// Clasificación Corriente/No corriente por prefijo de código (estilo PCGE):
// Activo 1x/2x = corriente (disponible, exigible, existencias); 3x = no
// corriente (inmovilizado). Pasivo: todo corriente salvo 45x (obligaciones
// financieras a largo plazo). Es una regla fija razonable para el plan de
// cuentas de esta empresa, no un motor de reglas configurable como en SAP
// (no hace falta para una sola empresa con un plan de cuentas fijo).
function esActivoNoCorriente(codigo: string) {
  return codigo.startsWith("3");
}
function esPasivoNoCorriente(codigo: string) {
  return codigo.startsWith("45");
}

export default async function SituacionFinancieraPage({
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
  const finDelMes = new Date(anio, mes, 1); // primer día del mes siguiente (límite exclusivo)

  const detalles = await prisma.asientoDetalle.findMany({
    where: { asiento: { fecha: { lt: finDelMes } } },
    include: { cuenta: true },
  });

  type Fila = { codigo: string; nombre: string; debe: number; haber: number };
  const porTipo: Record<string, Map<string, Fila>> = {
    ACTIVO: new Map(),
    PASIVO: new Map(),
    PATRIMONIO: new Map(),
    INGRESO: new Map(),
    GASTO: new Map(),
  };

  for (const d of detalles) {
    const mapa = porTipo[d.cuenta.tipo];
    const fila = mapa.get(d.cuentaId) ?? {
      codigo: d.cuenta.codigo,
      nombre: d.cuenta.nombre,
      debe: 0,
      haber: 0,
    };
    fila.debe += d.debe.toNumber();
    fila.haber += d.haber.toNumber();
    mapa.set(d.cuentaId, fila);
  }

  const filasNaturalDeudor = (mapa: Map<string, Fila>) =>
    [...mapa.values()]
      .map((f) => ({ ...f, saldo: f.debe - f.haber }))
      .filter((f) => Math.abs(f.saldo) > 0.004)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const filasNaturalAcreedor = (mapa: Map<string, Fila>) =>
    [...mapa.values()]
      .map((f) => ({ ...f, saldo: f.haber - f.debe }))
      .filter((f) => Math.abs(f.saldo) > 0.004)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const activo = filasNaturalDeudor(porTipo.ACTIVO);
  const pasivo = filasNaturalAcreedor(porTipo.PASIVO);
  const patrimonio = filasNaturalAcreedor(porTipo.PATRIMONIO);

  const activoCorriente = activo.filter((f) => !esActivoNoCorriente(f.codigo));
  const activoNoCorriente = activo.filter((f) => esActivoNoCorriente(f.codigo));
  const pasivoCorriente = pasivo.filter((f) => !esPasivoNoCorriente(f.codigo));
  const pasivoNoCorriente = pasivo.filter((f) => esPasivoNoCorriente(f.codigo));

  const totalIngresos = filasNaturalAcreedor(porTipo.INGRESO).reduce((acc, f) => acc + f.saldo, 0);
  const totalGastos = filasNaturalDeudor(porTipo.GASTO).reduce((acc, f) => acc + f.saldo, 0);
  const resultadoEjercicio = totalIngresos - totalGastos;

  const totalActivo = activo.reduce((acc, f) => acc + f.saldo, 0);
  const totalPasivo = pasivo.reduce((acc, f) => acc + f.saldo, 0);
  const totalPatrimonio = patrimonio.reduce((acc, f) => acc + f.saldo, 0) + resultadoEjercicio;
  const cuadrado = Math.round(totalActivo * 100) === Math.round((totalPasivo + totalPatrimonio) * 100);

  const mesAnterior = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
  const mesSiguiente = mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
  const nombreMes = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    new Date(anio, mes - 1, 1)
  );

  const sinDatos = detalles.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between no-imprimir mb-4">
        <div className="flex items-center gap-2">
          <Link href={`/finanzas/situacion-financiera?mes=${mesAnterior}`} className="boton-secundario px-2 py-1">
            ←
          </Link>
          <Link href={`/finanzas/situacion-financiera?mes=${mesSiguiente}`} className="boton-secundario px-2 py-1">
            →
          </Link>
        </div>
        <BotonImprimir />
      </div>

      <div className="documento max-w-3xl">
        <MembreteEmpresa soloImprimir tituloDocumento="ESTADO DE SITUACIÓN FINANCIERA" />
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Estado de situación financiera
        </h1>
        <p className="text-sm mt-1 capitalize" style={{ color: "var(--epicor-texto-tenue)" }}>
          Al cierre de {nombreMes} · saldos acumulados desde el inicio, leídos directamente del
          libro mayor.
        </p>

        {!cuadrado && !sinDatos && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
            ⚠ Activo ≠ Pasivo + Patrimonio: revise los asientos (puede haber transacciones sin
            postear por controles contables faltantes).
          </p>
        )}

        {sinDatos ? (
          <p className="text-center text-neutral-500 py-10">
            Sin asientos contables hasta esta fecha.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <section>
              <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: "var(--epicor-texto)" }}>
                Activo
              </h2>
              <table className="tabla tabla-densa mt-2">
                <tbody>
                  <tr>
                    <td colSpan={2} className="text-xs font-semibold text-neutral-500">
                      Activo corriente
                    </td>
                  </tr>
                  {activoCorriente.map((f) => (
                    <Fila key={f.codigo} codigo={f.codigo} nombre={f.nombre} valor={f.saldo} />
                  ))}
                  <FilaTotal
                    etiqueta="Total activo corriente"
                    valor={activoCorriente.reduce((a, f) => a + f.saldo, 0)}
                  />
                  <tr>
                    <td colSpan={2} className="text-xs font-semibold text-neutral-500 pt-3">
                      Activo no corriente
                    </td>
                  </tr>
                  {activoNoCorriente.map((f) => (
                    <Fila key={f.codigo} codigo={f.codigo} nombre={f.nombre} valor={f.saldo} />
                  ))}
                  <FilaTotal
                    etiqueta="Total activo no corriente"
                    valor={activoNoCorriente.reduce((a, f) => a + f.saldo, 0)}
                  />
                  <FilaTotal etiqueta="TOTAL ACTIVO" valor={totalActivo} />
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: "var(--epicor-texto)" }}>
                Pasivo
              </h2>
              <table className="tabla tabla-densa mt-2">
                <tbody>
                  <tr>
                    <td colSpan={2} className="text-xs font-semibold text-neutral-500">
                      Pasivo corriente
                    </td>
                  </tr>
                  {pasivoCorriente.map((f) => (
                    <Fila key={f.codigo} codigo={f.codigo} nombre={f.nombre} valor={f.saldo} />
                  ))}
                  <FilaTotal
                    etiqueta="Total pasivo corriente"
                    valor={pasivoCorriente.reduce((a, f) => a + f.saldo, 0)}
                  />
                  <tr>
                    <td colSpan={2} className="text-xs font-semibold text-neutral-500 pt-3">
                      Pasivo no corriente
                    </td>
                  </tr>
                  {pasivoNoCorriente.map((f) => (
                    <Fila key={f.codigo} codigo={f.codigo} nombre={f.nombre} valor={f.saldo} />
                  ))}
                  <FilaTotal
                    etiqueta="Total pasivo no corriente"
                    valor={pasivoNoCorriente.reduce((a, f) => a + f.saldo, 0)}
                  />
                  <FilaTotal etiqueta="Total pasivo" valor={totalPasivo} />
                </tbody>
              </table>

              <h2 className="font-semibold text-sm uppercase tracking-wide mt-6" style={{ color: "var(--epicor-texto)" }}>
                Patrimonio
              </h2>
              <table className="tabla tabla-densa mt-2">
                <tbody>
                  {patrimonio.map((f) => (
                    <Fila key={f.codigo} codigo={f.codigo} nombre={f.nombre} valor={f.saldo} />
                  ))}
                  <Fila codigo="" nombre="Resultado del ejercicio (acumulado)" valor={resultadoEjercicio} />
                  <FilaTotal etiqueta="Total patrimonio" valor={totalPatrimonio} />
                </tbody>
              </table>

              <table className="tabla tabla-densa mt-4">
                <tbody>
                  <tr className={cuadrado ? "bg-green-500/10" : "bg-red-500/10"}>
                    <td className="font-semibold">Total pasivo + patrimonio {cuadrado ? "✓" : "✗"}</td>
                    <td className="text-right font-semibold">
                      {formatMoneda(totalPasivo + totalPatrimonio)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ codigo, nombre, valor }: { codigo: string; nombre: string; valor: number }) {
  return (
    <tr>
      <td className="text-neutral-600 dark:text-neutral-400">
        {codigo && <span className="font-mono text-xs mr-1">{codigo}</span>}
        {nombre}
      </td>
      <td className="text-right">{formatMoneda(valor)}</td>
    </tr>
  );
}

function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <tr className="bg-amber-500/10">
      <td className="font-semibold" style={{ color: "var(--epicor-texto)" }}>{etiqueta}</td>
      <td className="text-right font-semibold" style={{ color: "var(--epicor-texto)" }}>
        {formatMoneda(valor)}
      </td>
    </tr>
  );
}
