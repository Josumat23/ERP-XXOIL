"use client";

import { useActionState } from "react";
import { aprobarVacaciones, type EstadoFormulario } from "../empleados/actions";

export default function AprobarVacacionesFormulario({ solicitudId }: { solicitudId: string }) {
  const accion = aprobarVacaciones.bind(null, solicitudId);
  const [estado, formAction, aprobando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {estado.error && (
        <span role="alert" className="max-w-72 text-xs text-red-600 dark:text-red-400">
          {estado.error}
        </span>
      )}
      <button
        type="submit"
        disabled={aprobando}
        className="boton-secundario text-xs px-2 py-1 disabled:opacity-50"
      >
        {aprobando ? "Aprobando..." : "Aprobar"}
      </button>
    </form>
  );
}