export type Rol = "ADMIN" | "ALMACEN" | "PRODUCCION" | "VENTAS" | "GERENCIA";

export type Enlace = { href: string; etiqueta: string; roles?: Rol[] };
export type Grupo = { titulo: string; enlaces: Enlace[] };
export type Modulo = { titulo: string | null; icono?: string; enlaces?: Enlace[]; grupos?: Grupo[] };

// Jerarquía adaptada de Epicor Kinetic (Sales/Material/Production/Financial
// Management + System Setup), traducida al español y mapeada a las rutas
// existentes del proyecto. Compartida entre el Sidebar (árbol de navegación)
// y la barra de programa (nombre de pantalla estilo Epicor).
export const MODULOS: Modulo[] = [
  {
    titulo: null,
    enlaces: [
      { href: "/", etiqueta: "Panel general" },
      { href: "/reportes", etiqueta: "Reportes" },
      { href: "/proyecciones", etiqueta: "Proyecciones" },
    ],
  },
  {
    titulo: "Ventas",
    icono: "◆",
    enlaces: [
      { href: "/comercial/cotizaciones", etiqueta: "Cotizaciones" },
      { href: "/comercial/pedidos", etiqueta: "Pedidos" },
      { href: "/comercial/facturas", etiqueta: "Facturas" },
      { href: "/comercial/hojas-ruta", etiqueta: "Hojas de ruta" },
      { href: "/comercial/comisiones", etiqueta: "Comisiones" },
      { href: "/comercial/clientes", etiqueta: "Clientes" },
      { href: "/comercial/descuentos-canal", etiqueta: "Descuento por canal", roles: ["ADMIN", "VENTAS", "GERENCIA"] },
      { href: "/comercial/cascos", etiqueta: "Cascos pendientes" },
      { href: "/comercial/backlog", etiqueta: "Backlog de pedidos" },
      { href: "/comercial/vendedores", etiqueta: "Vendedores" },
      { href: "/comercial/zonas", etiqueta: "Zonas" },
    ],
  },
  {
    titulo: "Materiales",
    icono: "▤",
    grupos: [
      {
        titulo: "Inventario",
        enlaces: [
          { href: "/catalogo/productos", etiqueta: "Productos" },
          { href: "/catalogo/presentaciones", etiqueta: "Presentaciones" },
          { href: "/catalogo/insumos", etiqueta: "Insumos" },
          { href: "/catalogo/categorias", etiqueta: "Categorías" },
          { href: "/inventario/kardex", etiqueta: "Kardex" },
          { href: "/inventario/ajustes", etiqueta: "Ajustes", roles: ["ADMIN", "ALMACEN"] },
          { href: "/inventario/traslados", etiqueta: "Traslados entre almacenes", roles: ["ADMIN", "ALMACEN"] },
          { href: "/inventario/conteos", etiqueta: "Conteo cíclico", roles: ["ADMIN", "ALMACEN"] },
          { href: "/inventario/rotacion-abc", etiqueta: "Rotación y ABC" },
          { href: "/inventario/exactitud", etiqueta: "Exactitud de inventario" },
        ],
      },
      {
        titulo: "Compras",
        enlaces: [
          { href: "/logistica/mrp", etiqueta: "MRP — Necesidades de compra" },
          { href: "/logistica/ordenes-compra", etiqueta: "Órdenes de compra" },
          { href: "/logistica/guias-remision", etiqueta: "Guías de remisión" },
          { href: "/logistica/inspeccion-compras", etiqueta: "Inspección de calidad" },
          { href: "/catalogo/proveedores", etiqueta: "Proveedores" },
          { href: "/catalogo/proveedores/evaluacion", etiqueta: "Evaluación de proveedores" },
        ],
      },
    ],
  },
  {
    titulo: "Producción",
    icono: "⚙",
    enlaces: [
      { href: "/produccion/formulas", etiqueta: "Fórmulas" },
      { href: "/produccion/lotes", etiqueta: "Órdenes de producción" },
      { href: "/produccion/calidad", etiqueta: "Control de calidad" },
      { href: "/produccion/calidad/reclamos", etiqueta: "Reclamos de cliente" },
      { href: "/produccion/envasados", etiqueta: "Envasados" },
      { href: "/produccion/lotes/recall", etiqueta: "Trazabilidad / recall" },
      { href: "/produccion/equipos", etiqueta: "Equipos" },
      { href: "/produccion/mantenimiento", etiqueta: "Mantenimiento" },
    ],
  },
  {
    titulo: "Finanzas",
    icono: "◇",
    grupos: [
      {
        titulo: "Tesorería",
        enlaces: [
          { href: "/finanzas/cuentas-por-cobrar", etiqueta: "Cuentas por cobrar" },
          { href: "/finanzas/cuentas-por-pagar", etiqueta: "Cuentas por pagar" },
          { href: "/finanzas/cobranza", etiqueta: "Gestión de cobranza", roles: ["ADMIN", "GERENCIA", "VENTAS"] },
          { href: "/finanzas/propuesta-pago", etiqueta: "Propuesta de pago", roles: ["ADMIN", "GERENCIA"] },
          { href: "/finanzas/caja", etiqueta: "Libro de caja" },
        ],
      },
      {
        titulo: "Contabilidad",
        enlaces: [
          { href: "/finanzas/asientos", etiqueta: "Asientos contables" },
          { href: "/finanzas/balance", etiqueta: "Balance de comprobación" },
          { href: "/finanzas/plan-cuentas", etiqueta: "Plan de cuentas", roles: ["ADMIN"] },
          { href: "/finanzas/centros-costo", etiqueta: "Centros de costo" },
          { href: "/finanzas/activos-fijos", etiqueta: "Activos fijos" },
          { href: "/finanzas/libros-electronicos", etiqueta: "Libros electrónicos (PLE)", roles: ["ADMIN", "GERENCIA"] },
        ],
      },
      {
        titulo: "Reportes",
        enlaces: [
          { href: "/finanzas/costos", etiqueta: "Costos y márgenes" },
          { href: "/finanzas/rentabilidad", etiqueta: "Rentabilidad por segmento/canal" },
          { href: "/finanzas/resultados", etiqueta: "Estado de resultados" },
          { href: "/finanzas/situacion-financiera", etiqueta: "Situación financiera" },
        ],
      },
    ],
  },
  {
    titulo: "Recursos Humanos",
    icono: "◈",
    enlaces: [
      { href: "/rrhh/empleados", etiqueta: "Empleados", roles: ["ADMIN", "GERENCIA"] },
      { href: "/rrhh/headcount", etiqueta: "Headcount por área", roles: ["ADMIN", "GERENCIA"] },
      { href: "/rrhh/vacaciones", etiqueta: "Solicitudes de vacaciones", roles: ["ADMIN", "GERENCIA"] },
      { href: "/rrhh/planilla", etiqueta: "Planilla", roles: ["ADMIN", "GERENCIA"] },
      { href: "/rrhh/planilla/parametros", etiqueta: "Parámetros de planilla", roles: ["ADMIN", "GERENCIA"] },
    ],
  },
  {
    titulo: "Configuración del Sistema",
    icono: "✦",
    enlaces: [
      { href: "/configuracion/empresa", etiqueta: "Empresa", roles: ["ADMIN"] },
      { href: "/configuracion/empresas", etiqueta: "Compañías (multi-empresa)", roles: ["ADMIN"] },
      { href: "/configuracion/usuarios", etiqueta: "Usuarios", roles: ["ADMIN"] },
      { href: "/configuracion/series", etiqueta: "Series de documentos", roles: ["ADMIN"] },
      { href: "/configuracion/almacenes", etiqueta: "Almacenes y zonas", roles: ["ADMIN", "ALMACEN"] },
      { href: "/configuracion/unidades-medida", etiqueta: "Unidades de medida", roles: ["ADMIN"] },
      { href: "/configuracion/grupos-seguridad", etiqueta: "Grupos de seguridad", roles: ["ADMIN"] },
      { href: "/configuracion/calendario-fiscal", etiqueta: "Calendario fiscal", roles: ["ADMIN"] },
      { href: "/configuracion/monitoreo", etiqueta: "Monitoreo", roles: ["ADMIN"] },
      { href: "/configuracion/tareas-programadas", etiqueta: "Tareas programadas", roles: ["ADMIN"] },
    ],
  },
];

// Aplana MODULOS a una lista de enlaces con su módulo padre, para que la
// barra de programa pueda ubicar el nombre de pantalla + módulo a partir
// de la ruta actual (más específico primero, para que /a/b no capture /a).
type EnlacePlano = Enlace & { modulo: string | null };

function aplanar(): EnlacePlano[] {
  const lista: EnlacePlano[] = [];
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces ?? []) lista.push({ ...enlace, modulo: modulo.titulo });
    for (const grupo of modulo.grupos ?? []) {
      for (const enlace of grupo.enlaces) lista.push({ ...enlace, modulo: modulo.titulo });
    }
  }
  return lista.sort((a, b) => b.href.length - a.href.length);
}

const ENLACES_PLANOS = aplanar();

export function ubicarPantalla(pathname: string): { etiqueta: string; modulo: string | null } | null {
  const encontrado = ENLACES_PLANOS.find((e) =>
    e.href === "/" ? pathname === "/" : pathname.startsWith(e.href)
  );
  return encontrado ? { etiqueta: encontrado.etiqueta, modulo: encontrado.modulo } : null;
}
