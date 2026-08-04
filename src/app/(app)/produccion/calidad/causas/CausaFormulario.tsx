"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearCausaCalidad } from "./actions";

export default function CausaFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: { error?: string; ok?: boolean }, formData: FormData) => {
      const resultado = await crearCausaCalidad(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <input
        name="nombre"
        required
        placeholder="Ej.: viscosidad fuera de rango"
        className="campo-input flex-1"
      />
      <button type="submit" disabled={enviando} className="boton-primario">
        {enviando ? "Guardando..." : "Agregar"}
      </button>
    </form>
  );
}
