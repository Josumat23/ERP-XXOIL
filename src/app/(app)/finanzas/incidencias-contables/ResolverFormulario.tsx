"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  incidenciaId: string;
};

export default function ResolverFormulario({ accion, incidenciaId }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={incidenciaId} />
      {estado.error && (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1"
        >
          {estado.error}
        </p>
      )}
      <div className="flex gap-2 items-start">
        <input
          type="text"
          name="nota"
          required
          maxLength={500}
          placeholder="Qué se hizo: asiento manual N.º…, control configurado…"
          className="campo-input text-xs flex-1 min-w-[200px]"
        />
        <button type="submit" disabled={enviando} className="boton-secundario text-xs shrink-0">
          {enviando ? "Resolviendo…" : "Marcar resuelta"}
        </button>
      </div>
    </form>
  );
}
