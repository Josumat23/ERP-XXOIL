"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  actividades: Opcion[];
};

export default function PrecedenciaFormulario({ accion, actividades }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap gap-2 items-end">
      {estado.error && <p className="text-sm text-red-600 dark:text-red-400 basis-full">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Predecesora</span>
        <select name="actividadPredecesoraId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>
              {a.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <span className="text-sm text-neutral-500 pb-2">debe terminar antes de</span>
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Sucesora</span>
        <select name="actividadSucesoraId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>
              {a.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Agregando..." : "+ Agregar precedencia"}
      </button>
    </form>
  );
}
