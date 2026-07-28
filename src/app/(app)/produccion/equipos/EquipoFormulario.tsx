"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Almacen = { id: string; nombre: string };
type ActivoFijo = { id: string; codigo: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  almacenes: Almacen[];
  activosFijos: ActivoFijo[];
  textoBoton: string;
};

export default function EquipoFormulario({ accion, almacenes, activosFijos, textoBoton }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <Campo etiqueta="Nombre del equipo">
        <input name="nombre" required placeholder="Autoclave AC-200" className="campo-input" />
      </Campo>

      <Campo etiqueta="Almacén / planta">
        <select name="almacenId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Activo fijo enlazado (opcional)">
        <select name="activoFijoId" defaultValue="" className="campo-input">
          <option value="">Sin enlazar</option>
          {activosFijos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} — {a.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <p className="text-xs text-neutral-500 -mt-2">
        Enlazar con Activos fijos permite ver la depreciación del equipo desde su ficha.
      </p>

      <Campo etiqueta="Notas">
        <textarea name="notas" rows={2} className="campo-input" />
      </Campo>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : textoBoton}
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
