"use client";

import { useActionState } from "react";
import { crearPlanillaMensual, type EstadoFormulario } from "./actions";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function PlanillaFormulario() {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearPlanillaMensual,
    {}
  );
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
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Mes</span>
          <select name="mes" defaultValue={hoy.getMonth() + 1} className="campo-input">
            {NOMBRE_MES.map((n, i) => (
              <option key={i + 1} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Año</span>
          <input name="anio" type="number" defaultValue={hoy.getFullYear()} className="campo-input w-24" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Calculando..." : "Generar planilla del mes"}
        </button>
      </div>
    </form>
  );
}
