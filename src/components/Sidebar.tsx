"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULOS, type Enlace, type Rol } from "@/lib/navegacion";

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
    <aside className="arbol-epicor w-60 shrink-0 min-h-screen flex flex-col">
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-[var(--epicor-borde)] bg-[var(--epicor-panel)]">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-none bg-[var(--epicor-azul)] text-white font-bold text-[11px]">
          GL
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[var(--epicor-texto)] leading-tight truncate">
            ERP Grasas &amp; Lubricantes
          </p>
          <p className="text-[10px] text-[var(--epicor-texto-tenue)] leading-tight">Main Menu</p>
        </div>
      </div>
      <nav className="py-1.5 pb-8 flex flex-col overflow-y-auto flex-1 text-[13px]">
        {MODULOS.map((modulo, idx) => {
          if (!modulo.titulo) {
            const enlaces = filtrarEnlaces(modulo.enlaces ?? []);
            return (
              <div key={idx} className="flex flex-col mb-1">
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
            <div key={idx}>
              <button
                type="button"
                onClick={() => alternar(modulo.titulo!)}
                className="w-full flex items-center gap-1 px-2 py-1 font-bold text-[13px] hover:bg-[var(--epicor-hover)]"
                aria-expanded={expandido}
              >
                <span className="text-[var(--epicor-texto-tenue)] w-3 inline-block text-[10px]">
                  {expandido ? "▾" : "▸"}
                </span>
                <span className="text-[13px]">📁</span>
                <span className={tieneActivo ? "text-[var(--epicor-azul)]" : "text-[var(--epicor-texto)]"}>
                  {modulo.titulo}
                </span>
              </button>

              {expandido && (
                <div className="flex flex-col">
                  {enlacesDirectos.map((enlace) => (
                    <EnlaceItem
                      key={enlace.href}
                      enlace={enlace}
                      activo={esActivo(pathname, enlace.href)}
                    />
                  ))}
                  {grupos.map((grupo) => (
                    <div key={grupo.titulo}>
                      <p className="pl-8 pr-2 py-0.5 text-[11px] font-semibold text-[var(--epicor-texto-tenue)] flex items-center gap-1">
                        <span>📁</span>
                        {grupo.titulo}
                      </p>
                      {grupo.enlaces.map((enlace) => (
                        <EnlaceItem
                          key={enlace.href}
                          enlace={enlace}
                          nivel={3}
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

function EnlaceItem({
  enlace,
  activo,
  nivel = 2,
}: {
  enlace: Enlace;
  activo: boolean;
  nivel?: 2 | 3;
}) {
  return (
    <Link
      href={enlace.href}
      className={`flex items-center gap-1 py-1 text-[13px] ${nivel === 3 ? "pl-11 pr-2" : "pl-7 pr-2"} ${
        activo
          ? "bg-[var(--epicor-seleccion)] text-[var(--epicor-texto)] font-semibold"
          : "text-[var(--epicor-texto)] hover:bg-[var(--epicor-hover)]"
      }`}
    >
      <span className="text-[11px] opacity-70">▫</span>
      {enlace.etiqueta}
    </Link>
  );
}
