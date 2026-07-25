"use client";

import { useState } from "react";

type Pestana = { id: string; etiqueta: string; contenido: React.ReactNode };

// Fichas por pestañas dentro de una misma página, al estilo de los "sheets"
// de Epicor dentro de un mismo programa. Las pestañas inactivas quedan en
// el DOM con `hidden` (no se desmontan): así no se pierde lo tecleado al
// cambiar de pestaña y los campos `required` ocultos no bloquean el envío
// del formulario (los navegadores excluyen los campos display:none de la
// validación nativa).
export default function FichaTabs({
  pestanas,
  className = "",
}: {
  pestanas: Pestana[];
  className?: string;
}) {
  const [activa, setActiva] = useState(pestanas[0]?.id);

  return (
    <div className={className}>
      <div
        role="tablist"
        className="flex gap-1 border-b border-[var(--epicor-borde)] mb-4 overflow-x-auto"
      >
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activa === p.id}
            onClick={() => setActiva(p.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activa === p.id
                ? "border-[var(--epicor-azul)] text-[var(--epicor-texto)]"
                : "border-transparent text-[var(--epicor-texto-tenue)] hover:text-[var(--epicor-texto)]"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      {pestanas.map((p) => (
        <div key={p.id} hidden={activa !== p.id}>
          {p.contenido}
        </div>
      ))}
    </div>
  );
}
