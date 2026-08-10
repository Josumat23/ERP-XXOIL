"use client";

import { useActionState } from "react";
import { rechazarOrdenCompra, type EstadoFormulario } from "../actions";

export default function RechazarOCFormulario({ ordenCompraId }: { ordenCompraId: string }) {
  const accion = rechazarOrdenCompra.bind(null, ordenCompraId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {estado.error && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1">
          {estado.error}
        </p>
      )}
      <input aria-label="Motivo del rechazo de la orden" name="motivo" required placeholder="Motivo del rechazo" className="campo-input text-sm py-1.5 flex-1 min-w-48" />
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {enviando ? "Rechazando…" : "Rechazar orden"}
      </button>
    </form>
  );
}
