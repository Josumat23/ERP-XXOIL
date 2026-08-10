"use client";

import { useActionState } from "react";
import { crearCts, type EstadoFormulario } from "./actions";

export default function CtsFormulario() {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(crearCts, {});
  const hoy = new Date();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 max-w-2xl">
          {estado.error}
        </p>
      )}
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Período</span>
          <select name="mitad" defaultValue="MAYO" className="campo-input">
            <option value="MAYO">Mayo (nov-abr)</option>
            <option value="NOVIEMBRE">Noviembre (may-oct)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Año</span>
          <input name="anio" type="number" defaultValue={hoy.getFullYear()} className="campo-input w-24" />
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Calculando..." : "Generar CTS"}
        </button>
      </div>
    </form>
  );
}
