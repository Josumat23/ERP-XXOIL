"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearCategoria, type EstadoFormulario } from "./actions";

type Accion = (prev: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export default function CategoriaFormulario({
  accion,
  valoresIniciales,
  textoBoton = "Agregar",
}: {
  accion?: Accion;
  valoresIniciales?: { nombre: string; descripcion: string | null };
  textoBoton?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await (accion ?? crearCategoria)(prev, formData);
      if (!resultado.error && !accion) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
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
      <div className="flex gap-3">
        <input
          aria-label="Nombre de la categoría"
          name="nombre"
          required
          defaultValue={valoresIniciales?.nombre}
          placeholder="Nombre de la categoría"
          className="campo-input flex-1"
        />
        <input
          aria-label="Descripción de la categoría"
          name="descripcion"
          defaultValue={valoresIniciales?.descripcion ?? ""}
          placeholder="Descripción (opcional)"
          className="campo-input flex-[2]"
        />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : textoBoton}
        </button>
      </div>
    </form>
  );
}
