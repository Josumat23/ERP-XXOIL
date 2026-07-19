"use client";

import { useActionState } from "react";
import { registrarCalidad, type EstadoFormulario } from "./actions";

export default function CalidadFormulario({ loteId }: { loteId: string }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    registrarCalidad,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <input type="hidden" name="loteId" value={loteId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Resultado</span>
          <select name="resultado" required defaultValue="" className="campo-input w-40">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="APROBADO">Aprobar</option>
            <option value="RECHAZADO">Rechazar</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Observaciones (obligatorias si rechaza)
          </span>
          <input name="observaciones" className="campo-input" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar resultado"}
        </button>
      </div>
    </form>
  );
}
