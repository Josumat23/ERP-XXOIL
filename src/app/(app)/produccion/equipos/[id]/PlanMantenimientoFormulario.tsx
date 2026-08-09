"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { crearPlanMantenimiento, type EstadoFormulario } from "../actions";

export default function PlanMantenimientoFormulario({
  equipoId,
  tieneUnidadContador,
}: {
  equipoId: string;
  tieneUnidadContador: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState("POR_TIEMPO");
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearPlanMantenimiento(equipoId, prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Nombre del plan</span>
          <input name="nombre" required placeholder="Cambio de aceite de motor" className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="campo-input"
          >
            <option value="POR_TIEMPO">Por tiempo</option>
            <option value="POR_CONTADOR" disabled={!tieneUnidadContador}>
              Por contador{!tieneUnidadContador ? " (defina unidad de contador primero)" : ""}
            </option>
          </select>
        </label>
        {tipo === "POR_TIEMPO" ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Cada (días)</span>
            <input name="frecuenciaDias" type="number" min="1" step="1" required className="campo-input w-28" />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Cada (unidades)</span>
            <input name="frecuenciaContador" type="number" min="0.01" step="0.01" required className="campo-input w-28" />
          </label>
        )}
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Guardando..." : "Agregar plan"}
        </button>
      </div>
    </form>
  );
}
