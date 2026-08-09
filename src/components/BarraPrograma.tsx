"use client";

import { usePathname } from "next/navigation";
import { ubicarPantalla } from "@/lib/navegacion";

// Encabezado de pantalla: título del programa activo + breadcrumb de módulo,
// más un acceso rápido para refrescar. Se inyecta una sola vez en el layout
// para que aparezca en todas las pantallas sin tocar cada página.
export default function BarraPrograma() {
  const pathname = usePathname();
  const pantalla = ubicarPantalla(pathname);
  const nombre = pantalla?.etiqueta ?? "ERP Grasas y Lubricantes";
  const modulo = pantalla?.modulo;

  return (
    <div className="barra-programa-epicor no-imprimir">
      <div className="flex items-baseline gap-2 min-w-0">
        {modulo && (
          <span className="text-[12px] font-normal text-[var(--epicor-texto-tenue)] truncate">
            {modulo} /
          </span>
        )}
        <span className="truncate">{nombre}</span>
      </div>
      <button
        type="button"
        title="Actualizar"
        aria-label="Actualizar pantalla"
        onClick={() => window.location.reload()}
        className="ml-auto rounded-lg p-1.5 text-[13px] text-[var(--epicor-texto-tenue)] hover:bg-[var(--epicor-hover)] hover:text-[var(--epicor-azul)] transition-colors"
      >
        ↻
      </button>
    </div>
  );
}
