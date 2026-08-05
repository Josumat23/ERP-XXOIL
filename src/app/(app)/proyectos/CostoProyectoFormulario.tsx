"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  edts: Opcion[];
};

export default function CostoProyectoFormulario({ accion, edts }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap gap-2 items-end">
      {estado.error && <p className="text-sm text-red-600 dark:text-red-400 basis-full">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Concepto</span>
        <input name="concepto" required placeholder="Ej: Mano de obra semana 3" className="campo-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm min-w-[160px]">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Fase (opcional)</span>
        <select name="edtId" defaultValue="" className="campo-input">
          <option value="">Sin fase específica</option>
          {edts.map((e) => (
            <option key={e.id} value={e.id}>
              {e.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Monto (S/)</span>
        <input name="monto" type="number" step="0.01" min="0.01" required className="campo-input w-32" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Agregando..." : "+ Agregar costo"}
      </button>
    </form>
  );
}
