"use client";

import { useActionState } from "react";
import { subirAdjunto, type EstadoFormulario } from "@/app/(app)/adjuntos/actions";

export default function SubirAdjuntoFormulario({
  entidadTipo,
  entidadId,
  rutaRevalidar,
}: {
  entidadTipo: string;
  entidadId: string;
  rutaRevalidar: string;
}) {
  const accion = subirAdjunto.bind(null, entidadTipo, entidadId, rutaRevalidar);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex items-end gap-3 flex-wrap">
      {estado.error && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1">
          {estado.error}
        </p>
      )}
      <fieldset disabled={enviando} className="contents">
      <input type="file" name="archivo" required aria-label="Archivo para adjuntar" className="text-sm" />
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "Subiendo..." : "Adjuntar archivo"}
      </button>
      </fieldset>
      <p aria-live="polite" className="sr-only">{enviando ? "Subiendo archivo" : ""}</p>
    </form>
  );
}
