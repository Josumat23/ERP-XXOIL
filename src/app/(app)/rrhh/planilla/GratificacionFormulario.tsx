"use client";

import { useActionState } from "react";
import { crearGratificacion, type EstadoFormulario } from "./actions";

export default function GratificacionFormulario() {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearGratificacion,
    {}
  );
  const hoy = new Date();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 max-w-2xl">
          {estado.error}
        </p>
      )}
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Semestre</span>
          <select name="mitad" defaultValue="JULIO" className="campo-input">
            <option value="JULIO">Julio (ene-jun)</option>
            <option value="DICIEMBRE">Diciembre (jul-dic)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Año</span>
          <input name="anio" type="number" defaultValue={hoy.getFullYear()} className="campo-input w-24" />
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Calculando..." : "Generar gratificación"}
        </button>
      </div>
    </form>
  );
}
