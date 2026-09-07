"use client";

import { useActionState } from "react";
import { asignarJefeDirecto, type EstadoFormulario } from "../actions";

type OpcionJefe = { id: string; etiqueta: string };

export default function JefaturaFormulario({
  empleadoId,
  jefeDirectoId,
  opciones,
}: {
  empleadoId: string;
  jefeDirectoId: string | null;
  opciones: OpcionJefe[];
}) {
  const accion = asignarJefeDirecto.bind(null, empleadoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Jefe directo</span>
        <select name="jefeDirectoId" defaultValue={jefeDirectoId ?? ""} className="campo-input">
          <option value="">Sin jefe directo / nivel raíz</option>
          {opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.etiqueta}</option>)}
        </select>
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Guardando…" : "Actualizar jefatura"}
      </button>
      {estado.error && <p role="alert" className="text-sm text-red-600 sm:basis-full">{estado.error}</p>}
    </form>
  );
}
