import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import { esPeriodoMensualValido } from "@/lib/periodos";
import BotonImprimir from "@/components/BotonImprimir";

export default async function VariacionesProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const hoy = new Date();
  const params = await searchParams;
  const solicitadoAnio = Number(params.anio ?? hoy.getFullYear());
  const solicitadoMes = Number(params.mes ?? hoy.getMonth() + 1);
  const valido = esPeriodoMensualValido(solicitadoAnio, solicitadoMes);
  const anio = valido ? solicitadoAnio : hoy.getFullYear();
  const mes = valido ? solicitadoMes : hoy.getMonth() + 1;
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const lotes = await prisma.loteGranel.findMany({
    where: {
      fechaFin: { gte: desde, lt: hasta },
      variacionTotal: { not: null },
    },
    include: { formula: { include: { producto: true } } },
    orderBy: [{ variacionTotal: "desc" }, { fechaFin: "desc" }],
  });

  const sumar = (campo: "costoEstandarPermitido" | "variacionInsumos" | "variacionManoObra" | "variacionRendimiento" | "variacionTotal") =>
    lotes.reduce((total, lote) => total + (lote[campo]?.toNumber() ?? 0), 0);
  const estandarPermitido = sumar("costoEstandarPermitido");
  const variacionTotal = sumar("variacionTotal");
  const costoReal = estandarPermitido + variacionTotal;

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
            Variaciones de producción
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
            Análisis plan/real por orden: consumo, eficiencia de mano de obra y rendimiento.
          </p>
        </div>
        <BotonImprimir />
      </div>

      <form className="flex flex-wrap items-end gap-3 mt-5 no-imprimir">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Año</span>
          <input name="anio" type="number" min="2000" max="2100" defaultValue={anio} className="campo-input w-28" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mes</span>
          <select name="mes" defaultValue={mes} className="campo-input">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((numero) => (
              <option key={numero} value={numero}>{numero}</option>
            ))}
          </select>
        </label>
        <button className="boton-secundario" type="submit">Aplicar</button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Kpi etiqueta="Órdenes analizadas" valor={String(lotes.length)} />
        <Kpi etiqueta="Estándar permitido" valor={formatMoneda(estandarPermitido)} />
        <Kpi etiqueta="Costo real" valor={formatMoneda(costoReal)} />
        <Kpi etiqueta="Variación total" valor={formatMoneda(variacionTotal)} adversa={variacionTotal > 0} />
      </div>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Orden</th><th>Producto</th><th className="text-right">Objetivo / real kg</th>
            <th className="text-right">Insumos</th><th className="text-right">Mano de obra</th>
            <th className="text-right">Rendimiento</th><th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((lote) => (
            <tr key={lote.id}>
              <td><Link href={`/produccion/lotes/${lote.id}`} className="font-mono text-xs hover:underline">{lote.codigo}</Link></td>
              <td>{lote.formula.producto.nombre}</td>
              <td className="text-right">{formatNumero(lote.kgObjetivo, 2)} / {formatNumero(lote.kgProducidos, 2)}</td>
              <CeldaVariacion valor={lote.variacionInsumos?.toNumber() ?? 0} />
              <CeldaVariacion valor={lote.variacionManoObra?.toNumber() ?? 0} />
              <CeldaVariacion valor={lote.variacionRendimiento?.toNumber() ?? 0} />
              <CeldaVariacion valor={lote.variacionTotal?.toNumber() ?? 0} fuerte />
            </tr>
          ))}
          {lotes.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-neutral-500">No hay órdenes finalizadas con base estándar en este período.</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-neutral-500 mt-2">
        Una variación positiva es desfavorable. Las órdenes históricas previas a esta función no se estiman retroactivamente.
      </p>
    </div>
  );
}

function Kpi({ etiqueta, valor, adversa = false }: { etiqueta: string; valor: string; adversa?: boolean }) {
  return <div className="border border-black/10 dark:border-white/10 rounded-lg p-3"><p className="text-xs text-neutral-500">{etiqueta}</p><p className={`text-xl font-semibold mt-1 ${adversa ? "text-red-600 dark:text-red-400" : ""}`}>{valor}</p></div>;
}

function CeldaVariacion({ valor, fuerte = false }: { valor: number; fuerte?: boolean }) {
  return <td className={`text-right ${fuerte ? "font-semibold" : ""} ${valor > 0 ? "text-red-600 dark:text-red-400" : valor < 0 ? "text-green-700 dark:text-green-400" : ""}`}>{formatMoneda(valor)}</td>;
}
