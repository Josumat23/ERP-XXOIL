"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", etiqueta: "Panel" },
  { href: "/catalogo/productos", etiqueta: "Productos" },
  { href: "/catalogo/presentaciones", etiqueta: "Presentaciones" },
  { href: "/catalogo/insumos", etiqueta: "Insumos" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-black/10 bg-neutral-50 dark:bg-neutral-900 dark:border-white/10 min-h-screen">
      <div className="px-5 py-5 border-b border-black/10 dark:border-white/10">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          ERP Grasas &amp; Lubricantes
        </p>
        <p className="text-xs text-neutral-500">Módulo: Catálogo</p>
      </div>
      <nav className="p-3 flex flex-col gap-1">
        {enlaces.map((enlace) => {
          const activo =
            enlace.href === "/"
              ? pathname === "/"
              : pathname.startsWith(enlace.href);
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activo
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {enlace.etiqueta}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
