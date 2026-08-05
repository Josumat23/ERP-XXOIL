import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import BarraRanking from "@/components/BarraRanking";

// Embudo de ventas simple (CRM-014 reducido): agrega las cotizaciones
// PENDIENTE por probabilidad estimada de cierre y por vendedor. No es un
// objeto "oportunidad" separado — Cotizacion ya cumple ese rol; esto solo
// suma visibilidad de pipeline sobre datos que ya existen.
const BUCKETS = [
  { etiqueta: "Baja (0-25%)", min: 0, max: 25 },
  { etiqueta: "Media (26-50%)", min: 26, max: 50 },
  { etiqueta: "Alta (51-75%)", min: 51, max: 75 },
  { etiqueta: "Casi cerrada (76-100%)", min: 76, max: 100 },
];

export default async function PipelinePage() {
  const cotizaciones = await prisma.cotizacion.findMany({
    where: { estado: "PENDIENTE", validaHasta: { gte: new Date() } },
    include: { cliente: true, vendedor: true },
    orderBy: { fecha: "desc" },
  });

  const totalPipeline = cotizaciones.reduce((acc, c) => acc + c.total.toNumber(), 0);
  const totalPonderado = cotizaciones.reduce(
    (acc, c) => acc + c.total.toNumber() * (c.probabilidad / 100),
    0
  );

  const porBucket = BUCKETS.map((b) => {
    const filas = cotizaciones.filter((c) => c.probabilidad >= b.min && c.probabilidad <= b.max);
    return {
      ...b,
      cantidad: filas.length,
      total: filas.reduce((acc, c) => acc + c.total.toNumber(), 0),
    };
  });
  const maxBucket = Math.max(...porBucket.map((b) => b.total), 1);

  const porVendedor = new Map<string, { nombre: string; total: number; ponderado: number; cantidad: number }>();
  for (const c of cotizaciones) {
    const fila = porVendedor.get(c.vendedorId) ?? {
      nombre: c.vendedor.nombre,
      total: 0,
      ponderado: 0,
      cantidad: 0,
    };
    fila.total += c.total.toNumber();
    fila.ponderado += c.total.toNumber() * (c.probabilidad / 100);
    fila.cantidad++;
    porVendedor.set(c.vendedorId, fila);
  }
  const filasVendedor = [...porVendedor.values()].sort((a, b) => b.ponderado - a.ponderado);
  const maxVendedor = Math.max(...filasVendedor.map((f) => f.ponderado), 1);

  const cotizacionesOrdenadas = [...cotizaciones].sort(
    (a, b) => b.total.toNumber() * (b.probabilidad / 100) - a.total.toNumber() * (a.probabilidad / 100)
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Embudo de ventas
          </h1>
          <p className="text-neutral-500 mt-1">
            Cotizaciones pendientes y vigentes, agrupadas por probabilidad de cierre estimada por el
            vendedor. El valor ponderado es lo que razonablemente se espera cerrar, no el total
            optimista.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <Link href="/comercial/cotizaciones" className="boton-secundario">
            Ver cotizaciones
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <p className="text-xs text-neutral-500">Cotizaciones en pipeline</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {cotizaciones.length}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <p className="text-xs text-neutral-500">Total del pipeline</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatMoneda(totalPipeline)}
          </p>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <p className="text-xs text-neutral-500">Valor ponderado (esperado)</p>
          <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {formatMoneda(totalPonderado)}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Por probabilidad</h2>
        <div className="flex flex-col gap-2">
          {porBucket.map((b) => (
            <BarraRanking
              key={b.etiqueta}
              etiqueta={`${b.etiqueta} (${b.cantidad})`}
              valor={b.total}
              max={maxBucket}
              formatoValor={(v) => formatMoneda(v)}
            />
          ))}
          {cotizaciones.length === 0 && (
            <p className="text-sm text-neutral-500">No hay cotizaciones pendientes vigentes.</p>
          )}
        </div>
      </section>

      {filasVendedor.length > 0 && (
        <section className="mt-8">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
            Por vendedor (valor ponderado)
          </h2>
          <div className="flex flex-col gap-2">
            {filasVendedor.map((f) => (
              <BarraRanking
                key={f.nombre}
                etiqueta={`${f.nombre} (${f.cantidad})`}
                valor={f.ponderado}
                max={maxVendedor}
                formatoValor={(v) => formatMoneda(v)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          Cotizaciones por valor ponderado
        </h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th className="text-right">Total</th>
              <th className="text-right">Prob.</th>
              <th className="text-right">Ponderado</th>
            </tr>
          </thead>
          <tbody>
            {cotizacionesOrdenadas.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">
                  <Link href={`/comercial/cotizaciones/${c.id}`} className="hover:underline">
                    {c.numero}
                  </Link>
                </td>
                <td>{c.cliente.razonSocial}</td>
                <td className="text-sm">{c.vendedor.nombre}</td>
                <td className="text-right">{formatMoneda(c.total)}</td>
                <td className="text-right text-neutral-500">{c.probabilidad}%</td>
                <td className="text-right font-medium">
                  {formatMoneda(c.total.toNumber() * (c.probabilidad / 100))}
                </td>
              </tr>
            ))}
            {cotizacionesOrdenadas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-6">
                  No hay cotizaciones pendientes vigentes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
