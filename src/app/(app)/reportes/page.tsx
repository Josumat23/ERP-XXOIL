import Link from "next/link";

type Reporte = { href: string; titulo: string; descripcion: string };
type Categoria = { titulo: string; reportes: Reporte[] };

// Directorio central de reportes: los reportes en sí viven en sus módulos
// naturales (Finanzas, Comercial) para no romper enlaces existentes; esta
// pantalla solo los junta en un solo lugar para no tener que recordar en
// qué submenú vive cada uno.
const CATEGORIAS: Categoria[] = [
  {
    titulo: "Comercial",
    reportes: [
      {
        href: "/finanzas/cuentas-por-cobrar",
        titulo: "Cuentas por cobrar",
        descripcion: "Facturas pendientes de cobro, con antigüedad de vencimiento (1-15 / 16-30 / +30 días).",
      },
      {
        href: "/comercial/cotizaciones",
        titulo: "Cotizaciones",
        descripcion: "Pendientes, aceptadas, rechazadas y convertidas a pedido — tasa de conversión.",
      },
      {
        href: "/comercial/cascos",
        titulo: "Cascos pendientes",
        descripcion: "Envases retornables entregados y no devueltos por cliente, con el depósito comprometido.",
      },
      {
        href: "/comercial/descuentos-canal",
        titulo: "Descuento por canal",
        descripcion: "Porcentaje de descuento configurado por canal de cliente (distribuidor, mayorista, taller...).",
      },
      {
        href: "/comercial/backlog",
        titulo: "Backlog de pedidos",
        descripcion: "Pedidos aceptados aún no facturados, por antigüedad — venta comprometida sin despachar.",
      },
      {
        href: "/comercial/atp",
        titulo: "ATP — Disponible para prometer",
        descripcion: "Stock empacado más granel aprobado sin envasar y lotes en proceso, por presentación.",
      },
    ],
  },
  {
    titulo: "Inventario",
    reportes: [
      {
        href: "/inventario/kardex",
        titulo: "Kardex",
        descripcion: "Historial de movimientos, filtrable por ítem y por almacén.",
      },
      {
        href: "/inventario/traslados",
        titulo: "Traslados entre almacenes",
        descripcion: "Stock por almacén y movimientos de traslado recientes.",
      },
      {
        href: "/inventario/conteos",
        titulo: "Conteos cíclicos",
        descripcion: "Historial de conteos físicos y las diferencias ajustadas contra el sistema.",
      },
      {
        href: "/inventario/rotacion-abc",
        titulo: "Rotación y clasificación ABC",
        descripcion: "Qué productos e insumos rotan y cuáles solo ocupan capital — clasificación de Pareto por valor.",
      },
      {
        href: "/inventario/exactitud",
        titulo: "Exactitud de inventario",
        descripcion: "Qué tan cerca está el stock del sistema de lo contado físicamente, conteo por conteo.",
      },
      {
        href: "/produccion/lotes/recall",
        titulo: "Trazabilidad / recall",
        descripcion: "Busca un lote granel y ve de un vistazo todos los envasados y clientes afectados.",
      },
      {
        href: "/produccion/mantenimiento",
        titulo: "Mantenimiento de planta",
        descripcion: "Órdenes de mantenimiento preventivo y correctivo, costos y paradas de equipo.",
      },
    ],
  },
  {
    titulo: "Compras",
    reportes: [
      {
        href: "/catalogo/proveedores/evaluacion",
        titulo: "Evaluación de proveedores",
        descripcion: "Tasa de aprobación en calidad, variación de precio y retraso de entrega, por proveedor.",
      },
    ],
  },
  {
    titulo: "Recursos Humanos",
    reportes: [
      {
        href: "/rrhh/headcount",
        titulo: "Headcount y costo por área",
        descripcion: "Trabajadores activos y costo base mensual, agrupados por área.",
      },
    ],
  },
  {
    titulo: "Finanzas",
    reportes: [
      {
        href: "/finanzas/resultados",
        titulo: "Estado de resultados",
        descripcion: "Ventas netas, costo de ventas, comisiones y gastos del mes — utilidad operativa.",
      },
      {
        href: "/finanzas/situacion-financiera",
        titulo: "Estado de situación financiera",
        descripcion: "Activo, pasivo y patrimonio acumulados al cierre del mes, desde el libro mayor.",
      },
      {
        href: "/finanzas/costos",
        titulo: "Costos y márgenes",
        descripcion: "Costo promedio de insumos, costo por kg de lotes y margen por presentación.",
      },
      {
        href: "/finanzas/cuentas-por-pagar",
        titulo: "Cuentas por pagar",
        descripcion: "Deudas pendientes con proveedores y pagos registrados.",
      },
      {
        href: "/finanzas/activos-fijos",
        titulo: "Activos fijos",
        descripcion: "Costo, depreciación acumulada y valor en libros de maquinaria, vehículos y equipos.",
      },
    ],
  },
  {
    titulo: "Contabilidad",
    reportes: [
      {
        href: "/finanzas/balance",
        titulo: "Balance de comprobación",
        descripcion: "Suma de debe y haber por cuenta contable en el período — debe cuadrar siempre.",
      },
    ],
  },
];

export default function ReportesPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Reportes</h1>
      <p className="text-neutral-500 mt-1">
        Todos los reportes del sistema, en un solo lugar.
      </p>

      <div className="flex flex-col gap-8 mt-6">
        {CATEGORIAS.map((cat) => (
          <section key={cat.titulo}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
              {cat.titulo}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cat.reportes.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:border-black/30 dark:hover:border-white/30 transition-colors"
                >
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.titulo}</p>
                  <p className="text-sm text-neutral-500 mt-1">{r.descripcion}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
