"use client";

import { useActionState } from "react";
import { rechazarPagoProveedor, type EstadoFormulario } from "../actions";

export default function RechazarPagoFormulario({ pagoId }: { pagoId: string }) {
  const accion = rechazarPagoProveedor.bind(null, pagoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {estado.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1">
          {estado.error}
        </p>
      )}
      <input name="motivo" required placeholder="Motivo del rechazo" className="campo-input text-xs py-1 flex-1 min-w-40" />
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-red-600 text-white px-2.5 py-1 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {enviando ? "..." : "Rechazar"}
      </button>
    </form>
  );
}
