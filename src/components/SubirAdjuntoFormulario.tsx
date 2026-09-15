"use client";

import { useActionState } from "react";
import { subirAdjunto, type EstadoFormulario } from "@/app/(app)/adjuntos/actions";
import { ETIQUETA_TIPO_DOCUMENTO, TIPOS_DOCUMENTO } from "@/lib/documentosAdjuntos";

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
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-600 dark:text-neutral-400">Qué documento es</span>
        <select name="tipoDocumento" defaultValue="" className="campo-input text-sm">
          <option value="">Sin clasificar</option>
          {TIPOS_DOCUMENTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_TIPO_DOCUMENTO[tipo]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-600 dark:text-neutral-400">Vence el</span>
        <input type="date" name="venceEl" className="campo-input text-sm" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "Subiendo..." : "Adjuntar archivo"}
      </button>
      </fieldset>
      <p aria-live="polite" className="sr-only">{enviando ? "Subiendo archivo" : ""}</p>
    </form>
  );
}
