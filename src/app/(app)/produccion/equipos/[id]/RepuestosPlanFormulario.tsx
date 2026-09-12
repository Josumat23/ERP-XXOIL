"use client";

import { useRef } from "react";
import { useActionState } from "react";
import type { EstadoFormulario } from "../actions";

type Opcion = { id: string; nombre: string; unidadMedida: string };

export default function RepuestosPlanFormulario({
  accion,
  insumos,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  insumos: Opcion[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  if (insumos.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No hay insumos activos en el catálogo para agregar como repuesto previsto.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {estado.error && (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1"
        >
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs flex-1 min-w-48">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Repuesto previsto</span>
          <select name="insumoId" required defaultValue="" className="campo-input text-xs">
            <option value="" disabled>
              Seleccione
            </option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidadMedida})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs w-28">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Cantidad</span>
          <input
            name="cantidad"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="campo-input text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs flex-1 min-w-32">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Nota (opcional)</span>
          <input name="notas" maxLength={200} className="campo-input text-xs" />
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario text-xs">
          {enviando ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </form>
  );
}
