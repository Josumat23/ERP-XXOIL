"use client";

import { useActionState } from "react";
import { solicitarVacaciones, type EstadoFormulario } from "../actions";

export default function VacacionesFormulario({ empleadoId }: { empleadoId: string }) {
  const accion = solicitarVacaciones.bind(null, empleadoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex items-end gap-3 flex-wrap">
      {estado.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Desde</span>
        <input name="fechaInicio" type="date" required className="campo-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Hasta</span>
        <input name="fechaFin" type="date" required className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Enviando..." : "Solicitar vacaciones"}
      </button>
    </form>
  );
}
