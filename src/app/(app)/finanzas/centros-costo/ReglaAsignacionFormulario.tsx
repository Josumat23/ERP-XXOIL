"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearReglaAsignacion, type EstadoFormulario } from "./actions";

type CentroOpcion = { id: string; etiqueta: string };
type Linea = { centroCostoId: string; porcentaje: string };

type Props = {
  centros: CentroOpcion[];
};

export default function ReglaAsignacionFormulario({ centros }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearReglaAsignacion,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([
    { centroCostoId: "", porcentaje: "" },
    { centroCostoId: "", porcentaje: "" },
  ]);

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({ centroCostoId: l.centroCostoId, porcentaje: Number(l.porcentaje) }))
  );
  const sumaPct = lineas.reduce((acc, l) => acc + (Number(l.porcentaje) || 0), 0);

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Nombre de la regla
        </span>
        <input
          name="nombre"
          required
          placeholder="Prorrateo depreciación mezcladora compartida"
          className="campo-input"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Centros y porcentaje de prorrateo
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                value={linea.centroCostoId}
                onChange={(e) => actualizarLinea(idx, { centroCostoId: e.target.value })}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione centro de costo
                </option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="%"
                value={linea.porcentaje}
                onChange={(e) => actualizarLinea(idx, { porcentaje: e.target.value })}
                className="campo-input w-24"
              />
              <button
                type="button"
                onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lineas.length === 2}
                className="text-neutral-400 hover:text-red-500 disabled:opacity-30 px-2"
                aria-label="Quitar línea"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setLineas((prev) => [...prev, { centroCostoId: "", porcentaje: "" }])
          }
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar centro
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4">
        <p
          className={`text-sm font-medium ${
            Math.abs(sumaPct - 100) > 0.5
              ? "text-red-600 dark:text-red-400"
              : "text-neutral-500"
          }`}
        >
          Suma de porcentajes: {sumaPct.toFixed(1)}% (debe ser 100%)
        </p>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Crear regla"}
        </button>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
