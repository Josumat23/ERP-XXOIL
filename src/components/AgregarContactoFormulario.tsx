"use client";

import { useActionState } from "react";
import { agregarContacto, type EstadoFormulario } from "@/app/(app)/contactos/actions";

export default function AgregarContactoFormulario({
  entidadTipo,
  entidadId,
  rutaRevalidar,
}: {
  entidadTipo: string;
  entidadId: string;
  rutaRevalidar: string;
}) {
  const accion = agregarContacto.bind(null, entidadTipo, entidadId, rutaRevalidar);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1">
          {estado.error}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="nombre" required placeholder="Nombre" className="campo-input text-sm" />
        <input name="cargo" placeholder="Cargo (opcional)" className="campo-input text-sm" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="telefono" placeholder="Teléfono" className="campo-input text-sm" />
        <input name="email" type="email" placeholder="Correo" className="campo-input text-sm" />
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-500">
        <input type="checkbox" name="esPrincipal" className="h-3.5 w-3.5" />
        Marcar como contacto principal
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs self-start">
        {enviando ? "Agregando..." : "Agregar contacto"}
      </button>
    </form>
  );
}
