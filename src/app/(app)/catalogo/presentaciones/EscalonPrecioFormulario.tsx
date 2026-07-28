"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearEscalonPrecio, type EstadoFormulario } from "./actions";

export default function EscalonPrecioFormulario({ presentacionId }: { presentacionId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const accion = crearEscalonPrecio.bind(null, presentacionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {estado.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">A partir de (unidades)</span>
        <input name="cantidadMinima" type="number" step="1" min="2" required className="campo-input w-28" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Precio (S/)</span>
        <input name="precio" type="number" step="0.01" min="0" required className="campo-input w-28" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Agregando..." : "Agregar escalón"}
      </button>
    </form>
  );
}
