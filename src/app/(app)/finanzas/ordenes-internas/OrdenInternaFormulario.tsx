"use client";

import { useActionState } from "react";
import { crearOrdenInterna, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

export default function OrdenInternaFormulario({ centrosCosto }: { centrosCosto: Opcion[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearOrdenInterna,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Descripción / propósito
        </span>
        <input
          name="descripcion"
          required
          placeholder="Ej: Campaña de lanzamiento Grasa Litio Q3"
          className="campo-input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Centro de costo de destino (opcional, se confirma al liquidar)
        </span>
        <select name="centroCostoId" defaultValue="" className="campo-input">
          <option value="">Sin definir todavía</option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Presupuesto (opcional, solo informativo)
        </span>
        <input name="presupuesto" type="number" step="0.01" min="0" placeholder="0.00" className="campo-input" />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando..." : "Crear orden interna"}
      </button>
    </form>
  );
}
