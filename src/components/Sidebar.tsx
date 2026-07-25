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
  // En pantallas chicas el menú es un panel deslizable (drawer) cerrado por defecto.
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_LOCALSTORAGE);
      if (guardado) setColapsados(new Set(JSON.parse(guardado)));
    } catch {
      // localStorage no disponible: se queda todo expandido
    }
  }, []);

  // Cerrar el drawer móvil al navegar a otra pantalla.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

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
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        className="lg:hidden fixed top-2.5 left-2.5 z-30 inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm no-imprimir"
        style={{ background: "var(--epicor-panel)", borderColor: "var(--epicor-borde)", color: "var(--epicor-texto)" }}
      >
        ☰
      </button>
      {abierto && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 no-imprimir"
          onClick={() => setAbierto(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`w-64 shrink-0 flex flex-col border-r border-[var(--epicor-borde)] bg-[var(--epicor-panel-2)]
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
        ${abierto ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:min-h-screen`}
      >
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-[var(--epicor-borde)]">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--epicor-azul)] text-white font-bold text-[13px] shadow-sm shrink-0">
          GL
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--epicor-texto)] leading-tight truncate">
            ERP Grasas &amp; Lubricantes
          </p>
          <p className="text-[11px] text-[var(--epicor-texto-tenue)] leading-tight">Sistema de gestión</p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar menú"
          className="lg:hidden shrink-0 text-[var(--epicor-texto-tenue)] hover:text-[var(--epicor-texto)] px-1"
        >
          ✕
        </button>
      </div>
      <nav className="py-3 px-2 pb-8 flex flex-col gap-0.5 overflow-y-auto flex-1 text-[13px]">
        {MODULOS.map((modulo, idx) => {
          if (!modulo.titulo) {
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
            <div key={idx}>
              <button
                type="button"
                onClick={() => alternar(modulo.titulo!)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg font-semibold text-[12px] uppercase tracking-wide hover:bg-[var(--epicor-hover)] text-[var(--epicor-texto-tenue)]"
                aria-expanded={expandido}
              >
                <span
                  className={`w-3 inline-block text-[9px] transition-transform ${expandido ? "rotate-90" : ""}`}
                >
                  ▸
                </span>
                <span className={tieneActivo ? "text-[var(--epicor-azul)]" : ""}>{modulo.titulo}</span>
              </button>

              {expandido && (
                <div className="flex flex-col gap-0.5 mb-1">
                  {enlacesDirectos.map((enlace) => (
                    <EnlaceItem
                      key={enlace.href}
                      enlace={enlace}
                      activo={esActivo(pathname, enlace.href)}
                    />
                  ))}
                  {grupos.map((grupo) => (
                    <div key={grupo.titulo}>
                      <p className="pl-6 pr-2 py-1 text-[11px] font-semibold text-[var(--epicor-texto-tenue)]">
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
    </>
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
      className={`flex items-center gap-2 py-1.5 rounded-lg text-[13px] transition-colors ${
        nivel === 3 ? "pl-9 pr-2" : "pl-4 pr-2"
      } ${
        activo
          ? "bg-[var(--epicor-seleccion)] text-[var(--epicor-azul-oscuro)] font-semibold"
          : "text-[var(--epicor-texto)] hover:bg-[var(--epicor-hover)]"
      }`}
    >
      {enlace.etiqueta}
    </Link>
  );
}
