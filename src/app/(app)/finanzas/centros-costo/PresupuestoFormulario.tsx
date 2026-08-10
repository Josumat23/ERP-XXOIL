"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  mesActual: number;
  anioActual: number;
};

export default function PresupuestoFormulario({ accion, mesActual, anioActual }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Mes</span>
          <select name="mes" defaultValue={mesActual} className="campo-input">
            {NOMBRE_MES.map((n, i) => (
              <option key={i + 1} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Año</span>
          <input name="anio" type="number" defaultValue={anioActual} className="campo-input w-24" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Monto (S/)</span>
          <input
            name="montoPresupuestado"
            type="number"
            step="0.01"
            min="0"
            required
            className="campo-input w-36"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : "Guardar presupuesto"}
        </button>
      </div>
    </form>
  );
}
