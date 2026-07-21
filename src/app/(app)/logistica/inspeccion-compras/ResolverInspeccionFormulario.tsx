"use client";

import { useActionState } from "react";
import { resolverInspeccionCompra, type EstadoFormulario } from "./actions";

export default function ResolverInspeccionFormulario({ inspeccionId }: { inspeccionId: string }) {
  const accion = resolverInspeccionCompra.bind(null, inspeccionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Observaciones</span>
        <textarea name="observaciones" rows={2} className="campo-input" />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          name="resultado"
          value="APROBADO"
          disabled={enviando}
          className="boton-primario"
        >
          {enviando ? "Guardando..." : "Aprobar"}
        </button>
        <button
          type="submit"
          name="resultado"
          value="RECHAZADO"
          disabled={enviando}
          className="boton-secundario"
        >
          {enviando ? "Guardando..." : "Rechazar"}
        </button>
      </div>
    </form>
  );
}
