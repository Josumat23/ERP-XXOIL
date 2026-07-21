"use client";

import { usePathname } from "next/navigation";
import { ubicarPantalla } from "@/lib/navegacion";

// Imita la barra azul de "programa activo" + la barra de herramientas gris
// (menú File/Edit/Tools/Actions/Help + iconos) que Epicor Kinetic muestra en
// cada Maintenance/Entry program. Se inyecta una sola vez en el layout para
// que aparezca en todas las pantallas sin tocar cada página.
export default function BarraPrograma() {
  const pathname = usePathname();
  const pantalla = ubicarPantalla(pathname);
  const nombre = pantalla?.etiqueta ?? "ERP Grasas y Lubricantes";
  const modulo = pantalla?.modulo;

  return (
    <div className="flex flex-col shrink-0">
      <div className="barra-programa-epicor">
        <span className="text-[11px]">📌</span>
        <span>{nombre}</span>
        {modulo && <span className="opacity-70 font-normal">— {modulo}</span>}
      </div>
      <div className="barra-herramientas-epicor no-imprimir">
        <span className="flex items-center gap-3 opacity-80">
          <span>File</span>
          <span>Edit</span>
          <span>Tools</span>
          <span>Actions</span>
          <span>Help</span>
        </span>
        <span className="w-px h-4 bg-[var(--epicor-borde)]" />
        <button
          type="button"
          title="Actualizar"
          onClick={() => window.location.reload()}
          className="hover:bg-[var(--epicor-hover)] px-1.5 py-0.5"
        >
          🔄
        </button>
        <button
          type="button"
          title="Imprimir"
          onClick={() => window.print()}
          className="hover:bg-[var(--epicor-hover)] px-1.5 py-0.5"
        >
          🖨
        </button>
      </div>
    </div>
  );
}
