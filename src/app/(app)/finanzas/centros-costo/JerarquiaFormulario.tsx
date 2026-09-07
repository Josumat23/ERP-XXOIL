"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Centro = { id: string; codigo: string; nombre: string };

export default function JerarquiaFormulario({
  accion,
  centroId,
  parentId,
  centros,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  centroId: string;
  parentId: string | null;
  centros: Centro[];
}) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Centro superior</span>
        <select name="parentId" defaultValue={parentId ?? ""} className="campo-input">
          <option value="">Nivel raíz</option>
          {centros.filter((centro) => centro.id !== centroId).map((centro) => (
            <option key={centro.id} value={centro.id}>{centro.codigo} — {centro.nombre}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Guardar jerarquía"}
      </button>
    </form>
  );
}
