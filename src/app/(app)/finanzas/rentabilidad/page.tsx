import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
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
type FilaAgregada = { ventas: number; costo: number };
type Filtros = { vendedorId?: string; zonaId?: string; clienteId?: string };

async function calcularAgregados(desde: Date, hasta: Date, filtros: Filtros) {
  const facturas = await prisma.factura.findMany({
    where: {
      fechaEmision: { gte: desde, lt: hasta },
      estado: { not: "ANULADA" },
      ...(filtros.vendedorId ? { vendedorId: filtros.vendedorId } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      ...(filtros.zonaId ? { cliente: { zonaId: filtros.zonaId } } : {}),
    },
    include: {
      cliente: true,
      pedido: {
        include: {
          detalles: { include: { presentacion: { include: { producto: true } } } },
        },
      },
    },
  });

  const porSegmento = new Map<string, FilaAgregada>();
  const porCanal = new Map<string, FilaAgregada>();

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

  const totalVentas = facturas.reduce((acc, f) => acc + f.subtotal.toNumber(), 0);
  const totalCosto = [...porSegmento.values()].reduce((acc, f) => acc + f.costo, 0);

  return { porSegmento, porCanal, totalVentas, totalCosto };
}

export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{
    anio?: string;
    mes?: string;
    comparar?: string;
    vendedorId?: string;
    zonaId?: string;
    clienteId?: string;
  }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");

  const hoy = new Date();
  const { anio: anioParam, mes: mesParam, comparar, vendedorId, zonaId, clienteId } =
    await searchParams;
  const anio = Number(anioParam) || hoy.getFullYear();
  const mes = Number(mesParam) || hoy.getMonth() + 1;
  const modoComparacion = comparar === "anio" ? "anio" : "mes";
  const filtros: Filtros = {
    vendedorId: vendedorId || undefined,
    zonaId: zonaId || undefined,
    clienteId: clienteId || undefined,
  };

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  const desdeAnterior =
    modoComparacion === "anio" ? new Date(anio - 1, mes - 1, 1) : new Date(anio, mes - 2, 1);
  const hastaAnterior =
    modoComparacion === "anio" ? new Date(anio - 1, mes, 1) : new Date(anio, mes - 1, 1);

  const [actual, anterior, vendedores, zonas, clientes] = await Promise.all([
    calcularAgregados(desde, hasta, filtros),
    calcularAgregados(desdeAnterior, hastaAnterior, filtros),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.zona.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ]);

  // Query string común para que el toggle de comparación y la navegación de
  // período no pierdan los filtros activos.
  const qsFiltros = new URLSearchParams();
  if (vendedorId) qsFiltros.set("vendedorId", vendedorId);
  if (zonaId) qsFiltros.set("zonaId", zonaId);
  if (clienteId) qsFiltros.set("clienteId", clienteId);
  const sufijoFiltros = qsFiltros.toString() ? `&${qsFiltros.toString()}` : "";

  const etiquetaSegmento = (s: string) =>
    s === "SIN_SEGMENTO" ? "Sin segmento asignado" : ETIQUETA_SEGMENTO_MERCADO[s as keyof typeof ETIQUETA_SEGMENTO_MERCADO];
  const etiquetaCanal = (c: string) =>
    c === "SIN_CANAL" ? "Sin canal asignado" : ETIQUETA_CANAL_CLIENTE[c as keyof typeof ETIQUETA_CANAL_CLIENTE];

  function combinarFilas(
    etiquetaFn: (clave: string) => string,
    mapaActual: Map<string, FilaAgregada>,
    mapaAnterior: Map<string, FilaAgregada>
  ) {
    const claves = new Set([...mapaActual.keys(), ...mapaAnterior.keys()]);
    return [...claves]
      .map((clave) => {
        const act = mapaActual.get(clave) ?? { ventas: 0, costo: 0 };
        const ant = mapaAnterior.get(clave) ?? { ventas: 0, costo: 0 };
        return {
          clave,
          etiqueta: etiquetaFn(clave),
          ventas: act.ventas,
          costo: act.costo,
          margen: act.ventas - act.costo,
          ventasAnterior: ant.ventas,
          margenAnterior: ant.ventas - ant.costo,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  }

  const filasSegmento = combinarFilas(etiquetaSegmento, actual.porSegmento, anterior.porSegmento);
  const filasCanal = combinarFilas(etiquetaCanal, actual.porCanal, anterior.porCanal);

  const totalVentas = actual.totalVentas;
  const totalCosto = actual.totalCosto;
  const totalMargen = totalVentas - totalCosto;
  const totalMargenAnterior = anterior.totalVentas - anterior.totalCosto;

  const nombreMes = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(desde);
  const nombreMesAnterior = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    desdeAnterior
  );

  function variacion(act: number, ant: number): { texto: string; positiva: boolean | null } {
    if (ant === 0) {
      if (act === 0) return { texto: "—", positiva: null };
      return { texto: "nuevo", positiva: act > 0 };
    }
    const v = ((act - ant) / Math.abs(ant)) * 100;
    return { texto: `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, positiva: v >= 0 };
  }

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
        producto y por canal del cliente. Distinto de &quot;Costos y márgenes&quot; (que es por SKU) y de
        &quot;Centros de costo&quot; (que es por área organizacional) — esto responde en qué línea de negocio
        se gana realmente.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 mb-4 no-imprimir">
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Vendedor</span>
          <select name="vendedorId" defaultValue={vendedorId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Zona</span>
          <select name="zonaId" defaultValue={zonaId ?? ""} className="campo-input">
            <option value="">Todas</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Cliente</span>
          <select name="clienteId" defaultValue={clienteId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razonSocial}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="comparar" value={modoComparacion} />
        <button type="submit" className="boton-secundario">
          Ver período
        </button>
        {(vendedorId || zonaId || clienteId) && (
          <Link href="/finanzas/rentabilidad" className="text-xs hover:underline text-neutral-500">
            Limpiar filtros
          </Link>
        )}
      </form>

      <div className="flex gap-2 mb-6 no-imprimir text-xs">
        <Link
          href={`/finanzas/rentabilidad?anio=${anio}&mes=${mes}&comparar=mes${sufijoFiltros}`}
          className={`px-2 py-1 rounded-md ${modoComparacion === "mes" ? "boton-primario" : "boton-secundario"}`}
        >
          vs. mes anterior
        </Link>
        <Link
          href={`/finanzas/rentabilidad?anio=${anio}&mes=${mes}&comparar=anio${sufijoFiltros}`}
          className={`px-2 py-1 rounded-md ${modoComparacion === "anio" ? "boton-primario" : "boton-secundario"}`}
        >
          vs. mismo mes año anterior
        </Link>
      </div>

      <p className="text-xs text-neutral-400 mb-2 capitalize">
        {nombreMes} — comparado contra {nombreMesAnterior}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Dato etiqueta="Ventas del período" valor={formatMoneda(totalVentas)} variacion={variacion(totalVentas, anterior.totalVentas)} />
        <Dato etiqueta="Costo de ventas" valor={formatMoneda(totalCosto)} variacion={variacion(-totalCosto, -anterior.totalCosto)} />
        <Dato etiqueta="Margen bruto" valor={formatMoneda(totalMargen)} variacion={variacion(totalMargen, totalMargenAnterior)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
            Por segmento de mercado
          </h2>
          <TablaRentabilidad encabezado="Segmento" filas={filasSegmento} variacionFn={variacion} />
        </section>
        <section>
          <h2 className="font-medium mb-2" style={{ color: "var(--epicor-texto)" }}>
            Por canal de cliente
          </h2>
          <TablaRentabilidad encabezado="Canal" filas={filasCanal} variacionFn={variacion} />
        </section>
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  variacion,
}: {
  etiqueta: string;
  valor: string;
  variacion?: { texto: string; positiva: boolean | null };
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        {etiqueta}
      </p>
      <p className="text-xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        {valor}
        {variacion && (
          <span
            className={`block text-xs font-normal ${
              variacion.positiva === null
                ? "text-neutral-400"
                : variacion.positiva
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {variacion.texto} vs. período anterior
          </span>
        )}
      </p>
    </div>
  );
}

function TablaRentabilidad({
  encabezado,
  filas,
  variacionFn,
}: {
  encabezado: string;
  filas: {
    clave: string;
    etiqueta: string;
    ventas: number;
    costo: number;
    margen: number;
    margenAnterior: number;
  }[];
  variacionFn: (act: number, ant: number) => { texto: string; positiva: boolean | null };
}) {
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th>{encabezado}</th>
          <th className="text-right">Ventas</th>
          <th className="text-right">Costo</th>
          <th className="text-right">Margen</th>
          <th className="text-right">Margen %</th>
          <th className="text-right">vs. anterior</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const v = variacionFn(f.margen, f.margenAnterior);
          return (
            <tr key={f.clave}>
              <td>{f.etiqueta}</td>
              <td className="text-right">{formatMoneda(f.ventas)}</td>
              <td className="text-right">{formatMoneda(f.costo)}</td>
              <td className="text-right">{formatMoneda(f.margen)}</td>
              <td className="text-right">{f.ventas > 0 ? `${((f.margen / f.ventas) * 100).toFixed(1)}%` : "—"}</td>
              <td
                className={`text-right text-xs ${
                  v.positiva === null
                    ? "text-neutral-400"
                    : v.positiva
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {v.texto}
              </td>
            </tr>
          );
        })}
        {filas.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center text-neutral-500 py-6">
              Sin ventas en el período.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
