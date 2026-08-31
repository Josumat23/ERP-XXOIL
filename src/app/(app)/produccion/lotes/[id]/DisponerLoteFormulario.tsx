"use client";

import { useActionState } from "react";
import { desecharLote, type EstadoFormulario } from "../../calidad/actions";

export default function DisponerLoteFormulario({ loteId }: { loteId: string }) {
  const accion = desecharLote.bind(null, loteId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      {estado.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.error}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Motivo y evidencia del descarte</span>
        <textarea name="motivo" required minLength={10} rows={3} className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario self-start">
        {enviando ? "Registrando descarte..." : "Desechar lote y reconocer pérdida"}
      </button>
    </form>
  );
}
