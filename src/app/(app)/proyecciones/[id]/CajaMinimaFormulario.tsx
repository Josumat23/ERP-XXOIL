"use client";

import { useActionState } from "react";
import { actualizarCajaMinima, type EstadoFormulario } from "../actions";

export default function CajaMinimaFormulario({
  proyeccionId,
  cajaMinimaDeseada,
}: {
  proyeccionId: string;
  cajaMinimaDeseada: number;
}) {
  const accion = actualizarCajaMinima.bind(null, proyeccionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex items-end gap-3 mt-4 max-w-xs flex-wrap">
      {estado.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Caja mínima deseada (S/)</span>
        <input name="cajaMinimaDeseada" type="number" step="0.01" min="0" defaultValue={cajaMinimaDeseada} className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-sm">
        {enviando ? "..." : "Guardar"}
      </button>
    </form>
  );
}
