"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Rol = "ADMIN" | "ALMACEN" | "PRODUCCION" | "VENTAS";

type Enlace = { href: string; etiqueta: string; roles?: Rol[] };
type Seccion = { titulo: string | null; enlaces: Enlace[] };

const SECCIONES: Seccion[] = [
  {
    titulo: null,
    enlaces: [{ href: "/", etiqueta: "Panel general" }],
  },
  {
    titulo: "Catálogo",
    enlaces: [
      { href: "/catalogo/productos", etiqueta: "Productos" },
      { href: "/catalogo/presentaciones", etiqueta: "Presentaciones" },
      { href: "/catalogo/insumos", etiqueta: "Insumos" },
      { href: "/catalogo/proveedores", etiqueta: "Proveedores" },
      { href: "/catalogo/categorias", etiqueta: "Categorías" },
    ],
  },
  {
    titulo: "Inventario",
    enlaces: [
      { href: "/inventario/kardex", etiqueta: "Kardex" },
      { href: "/inventario/ajustes", etiqueta: "Ajustes", roles: ["ADMIN", "ALMACEN"] },
    ],
  },
  {
    titulo: "Producción",
    enlaces: [
      { href: "/produccion/formulas", etiqueta: "Fórmulas" },
      { href: "/produccion/lotes", etiqueta: "Lotes granel" },
      { href: "/produccion/calidad", etiqueta: "Control de calidad" },
      { href: "/produccion/envasados", etiqueta: "Envasados" },
    ],
  },
  {
    titulo: "Comercial",
    enlaces: [
      { href: "/comercial/pedidos", etiqueta: "Pedidos" },
      { href: "/comercial/facturas", etiqueta: "Facturas" },
      { href: "/comercial/comisiones", etiqueta: "Comisiones" },
      { href: "/comercial/clientes", etiqueta: "Clientes" },
      { href: "/comercial/vendedores", etiqueta: "Vendedores" },
      { href: "/comercial/zonas", etiqueta: "Zonas" },
    ],
  },
  {
    titulo: "Configuración",
    enlaces: [{ href: "/configuracion/usuarios", etiqueta: "Usuarios", roles: ["ADMIN"] }],
  },
];

export default function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-black/10 bg-neutral-50 dark:bg-neutral-900 dark:border-white/10 min-h-screen">
      <div className="px-5 py-5 border-b border-black/10 dark:border-white/10">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          ERP Grasas &amp; Lubricantes
        </p>
        <p className="text-xs text-neutral-500">Fabricación y ventas</p>
      </div>
      <nav className="p-3 pb-8 flex flex-col gap-4 overflow-y-auto">
        {SECCIONES.map((seccion, idx) => {
          const visibles = seccion.enlaces.filter(
            (e) => !e.roles || rol === "ADMIN" || e.roles.includes(rol)
          );
          if (visibles.length === 0) return null;
          return (
            <div key={idx}>
              {seccion.titulo && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {seccion.titulo}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {visibles.map((enlace) => {
                  const activo =
                    enlace.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(enlace.href);
                  return (
                    <Link
                      key={enlace.href}
                      href={enlace.href}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        activo
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {enlace.etiqueta}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
