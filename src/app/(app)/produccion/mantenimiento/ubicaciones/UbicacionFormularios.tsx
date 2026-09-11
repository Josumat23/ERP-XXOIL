"use client";

import { useActionState, useRef } from "react";
import {
  crearUbicacionTecnica,
  reubicarUbicacionTecnica,
  type EstadoFormulario,
} from "./actions";

export type OpcionUbicacion = { id: string; etiqueta: string };

export function UbicacionFormulario({
  ubicaciones,
  plantas,
}: {
  ubicaciones: OpcionUbicacion[];
  plantas: { id: string; nombre: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearUbicacionTecnica(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <input
          aria-label="Código de la ubicación técnica"
          name="codigo"
          required
          placeholder="Código (ej. LINEA-A)"
          className="campo-input w-44 font-mono"
        />
        <input
          aria-label="Nombre de la ubicación técnica"
          name="nombre"
          required
          placeholder="Nombre"
          className="campo-input flex-1 min-w-48"
        />
        <select
          aria-label="Ubicación superior"
          name="parentId"
          defaultValue=""
          className="campo-input w-64"
        >
          <option value="">Sin ubicación superior (raíz)</option>
          {ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.etiqueta}
            </option>
          ))}
        </select>
        <select aria-label="Planta" name="almacenId" defaultValue="" className="campo-input w-52">
          <option value="">Planta (solo para raíces)</option>
          {plantas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar ubicación"}
        </button>
      </div>
    </form>
  );
}

export function ReubicarFormulario({
  id,
  parentIdActual,
  opciones,
}: {
  id: string;
  parentIdActual: string | null;
  opciones: OpcionUbicacion[];
}) {
  const [estado, formAction, enviando] = useActionState(
    reubicarUbicacionTecnica.bind(null, id),
    {} as EstadoFormulario
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        aria-label="Mover bajo"
        name="parentId"
        defaultValue={parentIdActual ?? ""}
        className="campo-input text-sm w-56"
      >
        <option value="">Raíz</option>
        {opciones.map((u) => (
          <option key={u.id} value={u.id}>
            {u.etiqueta}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={enviando}
        className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
      >
        Mover
      </button>
      {estado.error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {estado.error}
        </span>
      )}
    </form>
  );
}
