"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  empleados: Opcion[];
  equipos: Opcion[];
};

export default function ActividadFormulario({ accion, empleados, equipos }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap gap-2 items-end">
      {estado.error && <p className="text-sm text-red-600 dark:text-red-400 basis-full">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[160px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Actividad</span>
        <input name="nombre" required placeholder="Ej: Excavación" className="campo-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Duración (días)</span>
        <input name="duracionDias" type="number" step="1" min="1" required className="campo-input w-24" />
      </label>
      <label className="flex flex-col gap-1 text-sm min-w-[160px]">
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
      <label className="flex flex-col gap-1 text-sm min-w-[160px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Equipo (opcional)</span>
        <select name="equipoId" defaultValue="" className="campo-input">
          <option value="">Sin asignar</option>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Agregando..." : "+ Agregar actividad"}
      </button>
    </form>
  );
}
