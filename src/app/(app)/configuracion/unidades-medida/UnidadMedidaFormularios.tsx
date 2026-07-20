"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearClaseUnidadMedida, crearUnidadMedida, type EstadoFormulario } from "./actions";

export function ClaseFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearClaseUnidadMedida(prev, formData);
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
        <input name="codigo" required placeholder="Código (ej. PESO)" className="campo-input w-40 font-mono" />
        <input name="nombre" required placeholder="Nombre (ej. Peso)" className="campo-input flex-1 min-w-48" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar clase"}
        </button>
      </div>
    </form>
  );
}

export function UnidadFormulario({ clases }: { clases: { id: string; nombre: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearUnidadMedida(prev, formData);
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
        <select name="claseId" required defaultValue="" className="campo-input w-40">
          <option value="" disabled>
            Clase
          </option>
          {clases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input name="codigo" required placeholder="Código (ej. kg)" className="campo-input w-28 font-mono" />
        <input name="nombre" required placeholder="Nombre (ej. Kilogramo)" className="campo-input flex-1 min-w-48" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar unidad"}
        </button>
      </div>
    </form>
  );
}
