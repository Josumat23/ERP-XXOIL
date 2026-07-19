"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearFormula, type EstadoFormulario } from "./actions";

type Producto = { id: string; codigo: string; nombre: string };
type Insumo = { id: string; codigo: string; nombre: string; unidadMedida: string };

type Linea = { insumoId: string; cantidad: string };

type Props = {
  productos: Producto[];
  insumos: Insumo[];
};

export default function FormulaFormulario({ productos, insumos }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearFormula,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([{ insumoId: "", cantidad: "" }]);

  const detallesJson = JSON.stringify(
    lineas.map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) }))
  );

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Producto</span>
          <select name="productoId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Rendimiento del batch (kg de granel)
          </span>
          <input
            name="rendimientoKg"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="100"
            className="campo-input"
          />
        </label>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Insumos del batch
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                value={linea.insumoId}
                onChange={(e) => actualizarLinea(idx, { insumoId: e.target.value })}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione insumo
                </option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.codigo} — {i.nombre} ({i.unidadMedida})
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Cantidad"
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                className="campo-input w-32"
              />
              <button
                type="button"
                onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lineas.length === 1}
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
          onClick={() => setLineas((prev) => [...prev, { insumoId: "", cantidad: "" }])}
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar insumo
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas (opcional)</span>
        <textarea name="notas" rows={2} className="campo-input" />
      </label>

      <input type="hidden" name="detalles" value={detallesJson} />

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Crear versión de fórmula"}
      </button>
    </form>
  );
}
