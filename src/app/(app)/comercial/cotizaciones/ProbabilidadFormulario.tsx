"use client";

import { useState } from "react";
import { useActionState } from "react";
import { actualizarProbabilidad, type EstadoFormulario } from "./actions";

export default function ProbabilidadFormulario({
  cotizacionId,
  probabilidadActual,
}: {
  cotizacionId: string;
  probabilidadActual: number;
}) {
  const accion = actualizarProbabilidad.bind(null, cotizacionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [probabilidad, setProbabilidad] = useState(probabilidadActual);

  return (
    <form action={formAction} className="flex flex-col gap-2 max-w-xs no-imprimir">
      {estado.error && <p className="text-xs text-red-600 dark:text-red-400">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Probabilidad de cierre: {probabilidad}%
        </span>
        <input
          name="probabilidad"
          type="range"
          min="0"
          max="100"
          step="5"
          value={probabilidad}
          onChange={(e) => setProbabilidad(Number(e.target.value))}
        />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs self-start">
        {enviando ? "Guardando..." : "Actualizar probabilidad"}
      </button>
    </form>
  );
}
