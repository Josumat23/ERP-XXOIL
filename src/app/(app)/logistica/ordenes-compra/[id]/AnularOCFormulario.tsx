"use client";

import { useActionState } from "react";
import { anularOrdenCompra, type EstadoFormulario } from "../actions";

export default function AnularOCFormulario({ ordenCompraId }: { ordenCompraId: string }) {
  const accion = anularOrdenCompra.bind(null, ordenCompraId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {estado.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Motivo de anulación (obligatorio)
        </span>
        <input name="motivo" required className="campo-input" />
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {enviando ? "Anulando..." : "Anular orden"}
      </button>
    </form>
  );
}
