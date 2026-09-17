"use client";

import { useActionState, useRef } from "react";
import type { EstadoFormulario } from "../actions";

type Accion = (prev: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export default function EspecificacionCompetenciaFormulario({
  accion,
  opciones,
}: {
  accion: Accion;
  opciones: { id: string; etiqueta: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  if (opciones.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        No quedan especificaciones activas por agregar. El catálogo se administra en{" "}
        <a href="/catalogo/especificaciones" className="hover:underline">
          Especificaciones técnicas
        </a>
        .
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Según su ficha, cumple</span>
          <select name="especificacionId" required className="campo-input w-56">
            <option value="">Seleccione</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Guardando..." : "Agregar"}
        </button>
      </div>
    </form>
  );
}
