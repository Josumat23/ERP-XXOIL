"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  edts: Opcion[];
};

export default function EdtFormulario({ accion, edts }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap gap-2 items-end">
      {estado.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 basis-full">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[160px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Nombre de la fase</span>
        <input name="nombre" required placeholder="Ej: Cimentación" className="campo-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm min-w-[160px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Subfase de (opcional)</span>
        <select name="parentId" defaultValue="" className="campo-input">
          <option value="">Fase de primer nivel</option>
          {edts.map((e) => (
            <option key={e.id} value={e.id}>
              {e.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Presupuesto (opcional)</span>
        <input name="presupuesto" type="number" step="0.01" min="0" className="campo-input w-32" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Agregando..." : "+ Agregar fase"}
      </button>
    </form>
  );
}
