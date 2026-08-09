"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULOS, type Enlace, type Rol } from "@/lib/navegacion";

const CLAVE_LOCALSTORAGE = "erp.sidebar.colapsados";
// El evento nativo "storage" del navegador solo se dispara en OTRAS pestañas,
// nunca en la que hizo el cambio — este evento propio del Sidebar avisa a
// cualquier instancia montada en la misma pestaña para que vuelva a leer
// localStorage.
const EVENTO_SIDEBAR_COLAPSADOS = "erp:sidebar-colapsados-cambio";
const ID_MENU = "navegacion-principal";

function normalizarBusqueda(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function esActivo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function leerColapsadosCliente(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_LOCALSTORAGE);
  } catch {
    return null;
  }
}

// El servidor no tiene localStorage: se asume todo expandido (mismo valor
// por defecto de siempre), para que la hidratación no desajuste.
function obtenerSnapshotServidor(): string | null {
  return null;
}

function suscribirseAColapsados(notificar: () => void): () => void {
  window.addEventListener("storage", notificar);
  window.addEventListener(EVENTO_SIDEBAR_COLAPSADOS, notificar);
  return () => {
    window.removeEventListener("storage", notificar);
    window.removeEventListener(EVENTO_SIDEBAR_COLAPSADOS, notificar);
  };
}

export default function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname();

  const colapsadosGuardados = useSyncExternalStore(
    suscribirseAColapsados,
    leerColapsadosCliente,
    obtenerSnapshotServidor
  );
  const colapsados = useMemo<Set<string>>(() => {
    if (!colapsadosGuardados) return new Set();
    try {
      return new Set(JSON.parse(colapsadosGuardados));
    } catch {
      return new Set();
    }
  }, [colapsadosGuardados]);

  // En pantallas chicas el menú es un panel deslizable (drawer) cerrado por defecto.
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const panelMenu = useRef<HTMLElement>(null);
  const campoBusqueda = useRef<HTMLInputElement>(null);
  const devolverFocoAlCerrar = useRef(false);
  const terminoBusqueda = normalizarBusqueda(busqueda.trim());

  useEffect(() => {
    if (abierto) {
      campoBusqueda.current?.focus();
      return;
    }

    if (devolverFocoAlCerrar.current) {
      devolverFocoAlCerrar.current = false;
      botonAbrir.current?.focus();
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        devolverFocoAlCerrar.current = true;
        setAbierto(false);
      }
    }
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [abierto]);
  // Cierra el drawer móvil ante cualquier cambio real de ruta. Se ajusta
  // durante el propio render (comparando contra la ruta del render
  // anterior) en vez de en un efecto, así nunca reabre el menú al volver a
  // una ruta ya visitada.
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname);
  if (pathname !== pathnamePrevio) {
    setPathnamePrevio(pathname);
    setAbierto(false);
  }

  function cerrarMenuMovil() {
    devolverFocoAlCerrar.current = true;
    setAbierto(false);
  }

  function contenerFoco(evento: React.KeyboardEvent<HTMLElement>) {
    if (!abierto || evento.key !== "Tab") return;

    const elementos = Array.from(
      panelMenu.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((elemento) => elemento.offsetParent !== null);
    const primero = elementos[0];
    const ultimo = elementos.at(-1);
    if (!primero || !ultimo) return;

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  function alternar(titulo: string) {
    const siguiente = new Set(colapsados);
    if (siguiente.has(titulo)) siguiente.delete(titulo);
    else siguiente.add(titulo);
    try {
      window.localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify([...siguiente]));
      window.dispatchEvent(new Event(EVENTO_SIDEBAR_COLAPSADOS));
    } catch {
      // ignorar si no se puede persistir
    }
  }

  function filtrarEnlaces(enlaces: Enlace[], contexto: string[] = []): Enlace[] {
    return enlaces.filter((enlace) => {
      const permitido = !enlace.roles || rol === "ADMIN" || enlace.roles.includes(rol);
      if (!permitido || !terminoBusqueda) return permitido;
      return normalizarBusqueda([...contexto, enlace.etiqueta].join(" ")).includes(terminoBusqueda);
    });
  }

  const totalResultados = MODULOS.reduce((total, modulo) => {
    const contextoModulo = modulo.titulo && terminoBusqueda ? [modulo.titulo] : [];
    const directos = filtrarEnlaces(modulo.enlaces ?? [], contextoModulo).length;
    const agrupados = (modulo.grupos ?? []).reduce(
      (subtotal, grupo) => subtotal + filtrarEnlaces(grupo.enlaces, [...contextoModulo, grupo.titulo]).length,
      0
    );
    return total + directos + agrupados;
  }, 0);

  return (
    <>
      <button
        ref={botonAbrir}
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        aria-controls={ID_MENU}
        className="lg:hidden fixed top-2.5 left-2.5 z-30 inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm no-imprimir"
        style={{ background: "var(--epicor-panel)", borderColor: "var(--epicor-borde)", color: "var(--epicor-texto)" }}
      >
        ☰
      </button>
      {abierto && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 no-imprimir"
          onClick={cerrarMenuMovil}
          aria-hidden="true"
        />
      )}
      <aside
        ref={panelMenu}
        id={ID_MENU}
        onKeyDown={contenerFoco}
        className={`w-64 shrink-0 flex flex-col border-r border-[var(--epicor-borde)] bg-[var(--epicor-panel-2)]
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
        ${abierto ? "translate-x-0 visible" : "-translate-x-full invisible"} lg:translate-x-0 lg:visible lg:static lg:min-h-screen`}
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
          onClick={cerrarMenuMovil}
          aria-label="Cerrar menú"
          className="lg:hidden shrink-0 text-[var(--epicor-texto-tenue)] hover:text-[var(--epicor-texto)] px-1"
        >
          ✕
        </button>
      </div>
      <div className="px-3 py-3 border-b border-[var(--epicor-borde)]">
        <label htmlFor="buscar-pantalla" className="sr-only">Buscar pantalla</label>
        <div className="relative">
          <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--epicor-texto-tenue)]">⌕</span>
          <input
            ref={campoBusqueda}
            id="buscar-pantalla"
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape" && busqueda) {
                evento.stopPropagation();
                setBusqueda("");
              }
            }}
            placeholder="Buscar pantalla…"
            autoComplete="off"
            aria-describedby="estado-busqueda-pantallas"
            className="campo-input w-full pl-8 pr-3 py-2 text-[13px]"
          />
        </div>
        <p
          id="estado-busqueda-pantallas"
          aria-live="polite"
          className={terminoBusqueda && totalResultados === 0 ? "mt-2 text-xs text-[var(--epicor-texto-tenue)]" : "sr-only"}
        >
          {terminoBusqueda
            ? totalResultados === 0
              ? "No se encontraron pantallas. Presione Escape para limpiar la búsqueda."
              : `${totalResultados} ${totalResultados === 1 ? "pantalla encontrada" : "pantallas encontradas"}.`
            : ""}
        </p>
      </div>
      <nav aria-label="Navegación principal" className="py-3 px-2 pb-8 flex flex-col gap-0.5 overflow-y-auto flex-1 text-[13px]">
        {MODULOS.map((modulo, idx) => {
          if (!modulo.titulo) {
            const enlaces = filtrarEnlaces(modulo.enlaces ?? []);
            if (enlaces.length === 0) return null;
            return (
              <div key={idx} className="flex flex-col gap-0.5 mb-2">
                {enlaces.map((enlace) => (
                  <EnlaceItem key={enlace.href} enlace={enlace} activo={esActivo(pathname, enlace.href)} />
                ))}
              </div>
            );
          }

          const contextoModulo = terminoBusqueda ? [modulo.titulo] : [];
          const enlacesDirectos = filtrarEnlaces(modulo.enlaces ?? [], contextoModulo);
          const grupos = (modulo.grupos ?? [])
            .map((g) => ({ ...g, enlaces: filtrarEnlaces(g.enlaces, [...contextoModulo, g.titulo]) }))
            .filter((g) => g.enlaces.length > 0);

          if (enlacesDirectos.length === 0 && grupos.length === 0) return null;

          const expandido = Boolean(terminoBusqueda) || !colapsados.has(modulo.titulo);
          const tieneActivo =
            enlacesDirectos.some((e) => esActivo(pathname, e.href)) ||
            grupos.some((g) => g.enlaces.some((e) => esActivo(pathname, e.href)));

          return (
            <div key={idx}>
              <button
                type="button"
                onClick={() => alternar(modulo.titulo!)}
                disabled={Boolean(terminoBusqueda)}
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
      aria-current={activo ? "page" : undefined}
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
