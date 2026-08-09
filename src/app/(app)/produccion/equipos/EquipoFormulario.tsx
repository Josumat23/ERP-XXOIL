"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Almacen = { id: string; nombre: string };
type ActivoFijo = { id: string; codigo: string; nombre: string };
type CentroCosto = { id: string; codigo: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  almacenes: Almacen[];
  activosFijos: ActivoFijo[];
  centrosCosto: CentroCosto[];
  textoBoton: string;
};

export default function EquipoFormulario({
  accion,
  almacenes,
  activosFijos,
  centrosCosto,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
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

      <Campo etiqueta="Centro de costo (opcional)">
        <select name="centroCostoId" defaultValue="" className="campo-input">
          <option value="">Sin asignar</option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <p className="text-xs text-neutral-500 -mt-2">
        Se usa como centro por defecto al postear el gasto de mantenimiento de este equipo.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Unidad de contador (opcional)">
          <input name="unidadContador" placeholder="km, horas..." className="campo-input" />
        </Campo>
        <Campo etiqueta="Lectura inicial del contador">
          <input name="contadorActual" type="number" step="0.01" min="0" defaultValue={0} className="campo-input" />
        </Campo>
      </div>
      <p className="text-xs text-neutral-500 -mt-2">
        Solo necesario si va a tener planes de mantenimiento preventivo por contador (ej. cada 5,000 km).
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
