"use client";

import { useActionState } from "react";
import { reclasificarCosto, type EstadoFormulario } from "../actions";

type Opcion = { id: string; etiqueta: string };
type OpcionClave = { valor: string; etiqueta: string };

type Props = {
  claves: OpcionClave[];
  centros: Opcion[];
};

export default function ReclasificacionFormulario({ claves, centros }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    reclasificarCosto,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo de gasto</span>
        <select name="clave" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {claves.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Centro de origen</span>
          <select name="centroOrigenId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Centro de destino</span>
          <select name="centroDestinoId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Monto (S/)</span>
        <input name="monto" type="number" step="0.01" min="0.01" required className="campo-input w-40" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo</span>
        <textarea
          name="motivo"
          rows={2}
          required
          placeholder="Ej: El mantenimiento de la moto de reparto se cargó a Producción por error"
          className="campo-input"
        />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Reclasificando..." : "Reclasificar"}
      </button>
    </form>
  );
}
