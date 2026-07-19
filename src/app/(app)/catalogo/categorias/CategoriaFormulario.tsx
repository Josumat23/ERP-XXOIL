"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearCategoria } from "./actions";

export default function CategoriaFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: { error?: string }, formData: FormData) => {
      const resultado = await crearCategoria(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex gap-3">
        <input name="nombre" required placeholder="Nombre de la categoría" className="campo-input flex-1" />
        <input name="descripcion" placeholder="Descripción (opcional)" className="campo-input flex-[2]" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar"}
        </button>
      </div>
    </form>
  );
}
