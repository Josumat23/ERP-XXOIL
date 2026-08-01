import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { ETIQUETA_CANAL_CLIENTE, ETIQUETA_SEGMENTO_MERCADO } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Rentabilidad por segmento de mercado (Producto.segmentoMercado) y por
// canal de cliente (Cliente.canal) — el equivalente reducido al "Centro de
// Beneficio" de SAP CO: en vez de solo ver dónde se originan los costos
// (Centros de costo) o el margen por SKU (Costos y márgenes), esto responde
// "¿en qué línea de negocio / canal ganamos realmente?", ya descontado el
// costo de venta (no solo el precio de lista).
export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const hoy = new Date();
  const { anio: anioParam, mes: mesParam } = await searchParams;
  const anio = Number(anioParam) || hoy.getFullYear();
  const mes = Number(mesParam) || hoy.getMonth() + 1;

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const facturas = await prisma.factura.findMany({
    where: { fechaEmision: { gte: desde, lt: hasta }, estado: { not: "ANULADA" } },
    include: {
      cliente: true,
      pedido: {
        include: {
          detalles: { include: { presentacion: { include: { producto: true } } } },
        },
      },
    },
  });

  type Fila = { ventas: number; costo: number };
  const porSegmento = new Map<string, Fila>();
  const porCanal = new Map<string, Fila>();

  for (const f of facturas) {
    const canal = f.cliente.canal ?? "SIN_CANAL";
    for (const d of f.pedido.detalles) {
      const ventas = d.subtotal.toNumber();
      const costo = d.costoUnitario.toNumber() * d.cantidad;

      const segmento = d.presentacion.producto.segmentoMercado ?? "SIN_SEGMENTO";
      const filaSeg = porSegmento.get(segmento) ?? { ventas: 0, costo: 0 };
      filaSeg.ventas += ventas;
      filaSeg.costo += costo;
      porSegmento.set(segmento, filaSeg);

      const filaCanal = porCanal.get(canal) ?? { ventas: 0, costo: 0 };
      filaCanal.ventas += ventas;
      filaCanal.costo += costo;
      porCanal.set(canal, filaCanal);
    }
  }

  const etiquetaSegmento = (s: string) =>
    s === "SIN_SEGMENTO" ? "Sin segmento asignado" : ETIQUETA_SEGMENTO_MERCADO[s as keyof typeof ETIQUETA_SEGMENTO_MERCADO];
  const etiquetaCanal = (c: string) =>
    c === "SIN_CANAL" ? "Sin canal asignado" : ETIQUETA_CANAL_CLIENTE[c as keyof typeof ETIQUETA_CANAL_CLIENTE];

  const filasSegmento = [...porSegmento.entries()]
    .map(([clave, f]) => ({ clave, etiqueta: etiquetaSegmento(clave), ...f, margen: f.ventas - f.costo }))
    .sort((a, b) => b.ventas - a.ventas);
  const filasCanal = [...porCanal.entries()]
    .map(([clave, f]) => ({ clave, etiqueta: etiquetaCanal(clave), ...f, margen: f.ventas - f.costo }))
    .sort((a, b) => b.ventas - a.ventas);

  const totalVentas = facturas.reduce((acc, f) => acc + f.subtotal.toNumber(), 0);
  const totalCosto = filasSegmento.reduce((acc, f) => acc + f.costo, 0);
  const totalMargen = totalVentas - totalCosto;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Rentabilidad por segmento y canal
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Ventas menos costo de venta (no precio de lista), agrupado por segmento de mercado del
        producto y por canal del cliente. Distinto de "Costos y márgenes" (que es por SKU) y de
        "Centros de costo" (que es por área organizacional) — esto responde en qué línea de negocio
        se gana realmente.
      </p>

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Dato etiqueta="Ventas del período" valor={formatMoneda(totalVentas)} />
        <Dato etiqueta="Costo de ventas" valor={formatMoneda(totalCosto)} />
        <Dato etiqueta="Margen bruto" valor={formatMoneda(totalMargen)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
            Por segmento de mercado
          </h2>
          <TablaRentabilidad filas={filasSegmento} />
        </section>
        <section>
          <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
            Por canal de cliente
          </h2>
          <TablaRentabilidad filas={filasCanal} />
        </section>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        {etiqueta}
      </p>
      <p className="text-xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        {valor}
      </p>
    </div>
  );
}

function TablaRentabilidad({
  filas,
}: {
  filas: { clave: string; etiqueta: string; ventas: number; costo: number; margen: number }[];
}) {
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th></th>
          <th className="text-right">Ventas</th>
          <th className="text-right">Costo</th>
          <th className="text-right">Margen</th>
          <th className="text-right">Margen %</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.clave}>
            <td>{f.etiqueta}</td>
            <td className="text-right">{formatMoneda(f.ventas)}</td>
            <td className="text-right">{formatMoneda(f.costo)}</td>
            <td className="text-right">{formatMoneda(f.margen)}</td>
            <td className="text-right">{f.ventas > 0 ? `${((f.margen / f.ventas) * 100).toFixed(1)}%` : "—"}</td>
          </tr>
        ))}
        {filas.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-neutral-500 py-6">
              Sin ventas en el período.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
