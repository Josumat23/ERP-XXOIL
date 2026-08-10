"use client";

import { useActionState } from "react";
import { crearProyecto, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

export default function ProyectoFormulario({
  centrosCosto,
  empleados,
}: {
  centrosCosto: Opcion[];
  empleados: Opcion[];
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(crearProyecto, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Nombre del proyecto</span>
        <input name="nombre" required placeholder="Ampliación de planta Chiclayo" className="campo-input" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Descripción (opcional)</span>
        <textarea name="descripcion" rows={2} className="campo-input" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Centro de costo / área sponsor (opcional, solo informativo)
          </span>
          <select name="centroCostoId" defaultValue="" className="campo-input">
            <option value="">Sin asignar</option>
            {centrosCosto.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Responsable (opcional)</span>
          <select name="responsableId" defaultValue="" className="campo-input">
            <option value="">Sin asignar</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Presupuesto total (S/)</span>
        <input name="presupuestoTotal" type="number" step="0.01" min="0.01" required className="campo-input" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha de inicio planificada</span>
          <input name="fechaInicioPlan" type="date" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha de fin planificada</span>
          <input name="fechaFinPlan" type="date" required className="campo-input" />
        </label>
      </div>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando..." : "Crear proyecto"}
      </button>
    </form>
  );
}
