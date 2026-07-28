"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
};

export default function BajaFormulario({ accion }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo de la baja</span>
        <textarea name="motivoBaja" rows={2} required className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario self-start">
        {enviando ? "Registrando..." : "Dar de baja este activo"}
      </button>
    </form>
  );
}
