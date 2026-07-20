"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearGrupoSeguridad, type EstadoFormulario } from "./actions";

export default function GrupoFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearGrupoSeguridad(prev, formData);
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
      <div className="flex flex-wrap gap-3 items-end">
        <input name="codigo" required placeholder="Código (ej. SUPERVISOR)" className="campo-input w-48 font-mono" />
        <input name="nombre" required placeholder="Nombre del grupo" className="campo-input flex-1 min-w-48" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar grupo"}
        </button>
      </div>
    </form>
  );
}
