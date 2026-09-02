"use client";

import { useActionState } from "react";
import { finalizarLote, type EstadoFormulario } from "../actions";

type Props = { loteId: string; kgObjetivo: number; tieneRuta: boolean };

export default function FinalizarLoteFormulario({ loteId, kgObjetivo, tieneRuta }: Props) {
  const accion = finalizarLote.bind(null, loteId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex items-end gap-3">
        {!tieneRuta && <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Kg producidos (objetivo: {kgObjetivo})
          </span>
          <input
            name="kgProducidos"
            type="number"
            step="0.01"
            min="0"
            required
            className="campo-input w-48"
          />
        </label>}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Horas de mano de obra
          </span>
          <input
            name="horasManoObra"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="campo-input w-40"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Finalizar y enviar a calidad"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        La merma se calcula automáticamente. {tieneRuta ? "Las horas de mano de obra provienen de las operaciones confirmadas." : "Las horas se registran manualmente para esta orden histórica sin ruta."}
      </p>
    </form>
  );
}
