"use client";

import { useActionState } from "react";
import { actualizarContadorEquipo, type EstadoFormulario } from "../actions";

export default function ContadorFormulario({
  equipoId,
  contadorActual,
  unidadContador,
}: {
  equipoId: string;
  contadorActual: number;
  unidadContador: string;
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    actualizarContadorEquipo.bind(null, equipoId),
    {}
  );

  return (
    <form action={formAction} className="flex items-end gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Lectura del contador ({unidadContador})
        </span>
        <input
          name="contadorActual"
          type="number"
          step="0.01"
          min={contadorActual}
          defaultValue={contadorActual}
          className="campo-input w-40"
        />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Guardando..." : "Actualizar"}
      </button>
    </form>
  );
}
