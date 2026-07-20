"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Rol = "ADMIN" | "ALMACEN" | "PRODUCCION" | "VENTAS";

type Enlace = { href: string; etiqueta: string; roles?: Rol[] };
type Grupo = { titulo: string; enlaces: Enlace[] };
type Modulo = { titulo: string | null; icono?: string; enlaces?: Enlace[]; grupos?: Grupo[] };

// Jerarquía adaptada de Epicor Kinetic (Sales/Material/Production/Financial
// Management + System Setup), traducida al español y mapeada a las rutas
// existentes del proyecto.
const MODULOS: Modulo[] = [
  {
    titulo: null,
    enlaces: [{ href: "/", etiqueta: "Panel general" }],
  },
  {
    titulo: "Ventas",
    icono: "◆",
    enlaces: [
      { href: "/comercial/pedidos", etiqueta: "Pedidos" },
      { href: "/comercial/facturas", etiqueta: "Facturas" },
      { href: "/comercial/hojas-ruta", etiqueta: "Hojas de ruta" },
      { href: "/comercial/comisiones", etiqueta: "Comisiones" },
      { href: "/comercial/clientes", etiqueta: "Clientes" },
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
        ],
      },
      {
        titulo: "Compras",
        enlaces: [
          { href: "/logistica/ordenes-compra", etiqueta: "Órdenes de compra" },
          { href: "/logistica/guias-remision", etiqueta: "Guías de remisión" },
          { href: "/catalogo/proveedores", etiqueta: "Proveedores" },
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
      { href: "/produccion/envasados", etiqueta: "Envasados" },
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
          { href: "/finanzas/caja", etiqueta: "Libro de caja" },
        ],
      },
      {
        titulo: "Contabilidad",
        enlaces: [
          { href: "/finanzas/asientos", etiqueta: "Asientos contables" },
          { href: "/finanzas/balance", etiqueta: "Balance de comprobación" },
          { href: "/finanzas/plan-cuentas", etiqueta: "Plan de cuentas", roles: ["ADMIN"] },
        ],
      },
      {
        titulo: "Reportes",
        enlaces: [
          { href: "/finanzas/costos", etiqueta: "Costos y márgenes" },
          { href: "/finanzas/resultados", etiqueta: "Estado de resultados" },
        ],
      },
    ],
  },
  {
    titulo: "Configuración del Sistema",
    icono: "✦",
    enlaces: [
      { href: "/configuracion/empresa", etiqueta: "Empresa", roles: ["ADMIN"] },
      { href: "/configuracion/usuarios", etiqueta: "Usuarios", roles: ["ADMIN"] },
      { href: "/configuracion/series", etiqueta: "Series de documentos", roles: ["ADMIN"] },
      { href: "/configuracion/almacenes", etiqueta: "Almacenes y zonas", roles: ["ADMIN", "ALMACEN"] },
      { href: "/configuracion/unidades-medida", etiqueta: "Unidades de medida", roles: ["ADMIN"] },
      { href: "/configuracion/grupos-seguridad", etiqueta: "Grupos de seguridad", roles: ["ADMIN"] },
      { href: "/configuracion/calendario-fiscal", etiqueta: "Calendario fiscal", roles: ["ADMIN"] },
    ],
  },
];

const CLAVE_LOCALSTORAGE = "erp.sidebar.colapsados";

function esActivo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  // Por defecto todo expandido (coincide con el render del servidor, sin
  // parpadeo ni desajuste de hidratación); luego de montar se aplican los
  // módulos que el usuario había colapsado antes.
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_LOCALSTORAGE);
      if (guardado) setColapsados(new Set(JSON.parse(guardado)));
    } catch {
      // localStorage no disponible: se queda todo expandido
    }
  }, []);

  function alternar(titulo: string) {
    setColapsados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(titulo)) siguiente.delete(titulo);
      else siguiente.add(titulo);
      try {
        window.localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify([...siguiente]));
      } catch {
        // ignorar si no se puede persistir
      }
      return siguiente;
    });
  }

  function filtrarEnlaces(enlaces: Enlace[]): Enlace[] {
    return enlaces.filter((e) => !e.roles || rol === "ADMIN" || e.roles.includes(rol));
  }

  return (
    <aside className="w-64 shrink-0 border-r border-black/10 bg-neutral-50 dark:bg-neutral-900 dark:border-white/10 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-sm">
            GL
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
              ERP Grasas &amp; Lubricantes
            </p>
            <p className="text-[11px] text-neutral-500 leading-tight">Fabricación y ventas</p>
          </div>
        </div>
      </div>
      <nav className="p-3 pb-8 flex flex-col gap-1 overflow-y-auto flex-1">
        {MODULOS.map((modulo, idx) => {
          if (!modulo.titulo) {
            // Enlace raíz sin agrupar (Panel general)
            const enlaces = filtrarEnlaces(modulo.enlaces ?? []);
            return (
              <div key={idx} className="flex flex-col gap-0.5 mb-2">
                {enlaces.map((enlace) => (
                  <EnlaceItem key={enlace.href} enlace={enlace} activo={esActivo(pathname, enlace.href)} />
                ))}
              </div>
            );
          }

          const enlacesDirectos = filtrarEnlaces(modulo.enlaces ?? []);
          const grupos = (modulo.grupos ?? [])
            .map((g) => ({ ...g, enlaces: filtrarEnlaces(g.enlaces) }))
            .filter((g) => g.enlaces.length > 0);

          if (enlacesDirectos.length === 0 && grupos.length === 0) return null;

          const expandido = !colapsados.has(modulo.titulo);
          const tieneActivo =
            enlacesDirectos.some((e) => esActivo(pathname, e.href)) ||
            grupos.some((g) => g.enlaces.some((e) => esActivo(pathname, e.href)));

          return (
            <div key={idx} className="mb-1">
              <button
                type="button"
                onClick={() => alternar(modulo.titulo!)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                aria-expanded={expandido}
              >
                <span className="text-neutral-400 dark:text-neutral-500 w-3 inline-block">
                  {expandido ? "▾" : "▸"}
                </span>
                {modulo.icono && <span>{modulo.icono}</span>}
                <span className={tieneActivo ? "text-amber-700 dark:text-amber-400" : ""}>
                  {modulo.titulo}
                </span>
              </button>

              {expandido && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {enlacesDirectos.map((enlace) => (
                    <EnlaceItem
                      key={enlace.href}
                      enlace={enlace}
                      activo={esActivo(pathname, enlace.href)}
                    />
                  ))}
                  {grupos.map((grupo) => (
                    <div key={grupo.titulo} className="mt-1">
                      <p className="px-8 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
                        {grupo.titulo}
                      </p>
                      {grupo.enlaces.map((enlace) => (
                        <EnlaceItem
                          key={enlace.href}
                          enlace={enlace}
                          activo={esActivo(pathname, enlace.href)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function EnlaceItem({ enlace, activo }: { enlace: Enlace; activo: boolean }) {
  return (
    <Link
      href={enlace.href}
      className={`mx-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors border-l-2 ${
        activo
          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-transparent text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {enlace.etiqueta}
    </Link>
  );
}
