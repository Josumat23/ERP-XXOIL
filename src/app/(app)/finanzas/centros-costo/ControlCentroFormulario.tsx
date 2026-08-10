"use client";

import { useActionState } from "react";
import { guardarAsignacionControl, type EstadoFormulario } from "./actions";
import type { ClaveControl } from "@/lib/contabilidad";

type Opcion = { id: string; etiqueta: string };

export default function ControlCentroFormulario({
  clave,
  etiqueta,
  valorActual,
  centros,
  reglas,
}: {
  clave: ClaveControl;
  etiqueta: string;
  valorActual: string;
  centros: Opcion[];
  reglas: Opcion[];
}) {
  const accion = guardarAsignacionControl.bind(null, clave);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (_prev, formData) => accion(formData),
    {}
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <span className="text-sm w-72 shrink-0">{etiqueta}</span>
      <select aria-label={etiqueta} name="valor" defaultValue={valorActual} className="campo-input flex-1">
        <option value="">Sin asignar (no se prorratea a ningún centro)</option>
        {centros.length > 0 && (
          <optgroup label="Centro directo">
            {centros.map((c) => (
              <option key={c.id} value={`centro:${c.id}`}>
                {c.etiqueta}
              </option>
            ))}
          </optgroup>
        )}
        {reglas.length > 0 && (
          <optgroup label="Regla de prorrateo">
            {reglas.map((r) => (
              <option key={r.id} value={`regla:${r.id}`}>
                {r.etiqueta}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs whitespace-nowrap">
        {enviando ? "Guardando…" : "Guardar"}
      </button>
      {estado.error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{estado.error}</span>}
    </form>
  );
}
