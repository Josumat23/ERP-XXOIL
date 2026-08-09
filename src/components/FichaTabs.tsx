"use client";

import { useId, useRef, useState } from "react";

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
  const botones = useRef<Array<HTMLButtonElement | null>>([]);
  const identificador = useId().replaceAll(":", "");

  function activarConTeclado(indice: number) {
    const pestana = pestanas[indice];
    if (!pestana) return;

    setActiva(pestana.id);
    botones.current[indice]?.focus();
  }

  function manejarTeclado(
    evento: React.KeyboardEvent<HTMLButtonElement>,
    indice: number
  ) {
    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      activarConTeclado((indice + 1) % pestanas.length);
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      activarConTeclado((indice - 1 + pestanas.length) % pestanas.length);
    } else if (evento.key === "Home") {
      evento.preventDefault();
      activarConTeclado(0);
    } else if (evento.key === "End") {
      evento.preventDefault();
      activarConTeclado(pestanas.length - 1);
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Secciones de la ficha"
        className="flex gap-1 border-b border-[var(--epicor-borde)] mb-4 overflow-x-auto"
      >
        {pestanas.map((p, indice) => (
          <button
            key={p.id}
            ref={(elemento) => {
              botones.current[indice] = elemento;
            }}
            type="button"
            role="tab"
            id={`${identificador}-pestana-${indice}`}
            aria-controls={`${identificador}-panel-${indice}`}
            aria-selected={activa === p.id}
            tabIndex={activa === p.id ? 0 : -1}
            onClick={() => setActiva(p.id)}
            onKeyDown={(evento) => manejarTeclado(evento, indice)}
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
      {pestanas.map((p, indice) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`${identificador}-panel-${indice}`}
          aria-labelledby={`${identificador}-pestana-${indice}`}
          hidden={activa !== p.id}
        >
          {p.contenido}
        </div>
      ))}
    </div>
  );
}
