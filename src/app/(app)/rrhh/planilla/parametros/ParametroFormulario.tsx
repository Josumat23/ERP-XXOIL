"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearParametroPlanilla } from "./actions";

export default function ParametroFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: { error?: string; ok?: boolean }, formData: FormData) => {
      const resultado = await crearParametroPlanilla(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 max-w-2xl">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Guardado.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Campo etiqueta="RMV (S/)">
          <input name="rmv" type="number" step="0.01" min="0" required className="campo-input" />
        </Campo>
        <Campo etiqueta="UIT (S/)">
          <input name="uit" type="number" step="0.01" min="0" required className="campo-input" />
        </Campo>
        <Campo etiqueta="EsSalud (%)">
          <input name="tasaEsSalud" type="number" step="0.01" min="0" defaultValue={9} className="campo-input" />
        </Campo>
        <Campo etiqueta="ONP (%)">
          <input name="tasaOnp" type="number" step="0.01" min="0" defaultValue={13} className="campo-input" />
        </Campo>
        <Campo etiqueta="Vigente desde">
          <input name="vigenteDesde" type="date" required className="campo-input" />
        </Campo>
      </div>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Agregar parámetros"}
      </button>
    </form>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}
