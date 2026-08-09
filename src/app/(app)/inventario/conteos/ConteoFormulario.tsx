"use client";

import { useState, useActionState } from "react";
import { crearConteo, type EstadoFormulario } from "./actions";

type Item = { valor: string; etiqueta: string; stock: number };
type Linea = { tipoItem: string; itemId: string; cantidadContada: string };

export default function ConteoFormulario({
  presentaciones,
  insumos,
}: {
  presentaciones: Item[];
  insumos: Item[];
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearConteo,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([{ tipoItem: "", itemId: "", cantidadContada: "" }]);

  const todos = [...presentaciones, ...insumos];

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  const lineasJson = JSON.stringify(
    lineas
      .filter((l) => l.itemId)
      .map((l) => {
        const [tipoItem, itemId] = l.itemId.split(":");
        return { tipoItem, itemId, cantidadContada: Number(l.cantidadContada) };
      })
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {lineas.map((linea, idx) => {
          const item = todos.find((t) => t.valor === linea.itemId);
          const diferencia =
            item && linea.cantidadContada !== "" ? Number(linea.cantidadContada) - item.stock : null;
          return (
            <div key={idx} className="flex flex-wrap gap-2 items-center">
              <select
                value={linea.itemId}
                onChange={(e) => actualizarLinea(idx, { itemId: e.target.value })}
                className="campo-input flex-1 min-w-56"
              >
                <option value="" disabled>
                  Seleccione ítem
                </option>
                <optgroup label="Presentaciones">
                  {presentaciones.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.etiqueta} (sistema: {p.stock})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Insumos">
                  {insumos.map((i) => (
                    <option key={i.valor} value={i.valor}>
                      {i.etiqueta} (sistema: {i.stock})
                    </option>
                  ))}
                </optgroup>
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Contado"
                value={linea.cantidadContada}
                onChange={(e) => actualizarLinea(idx, { cantidadContada: e.target.value })}
                className="campo-input w-28"
              />
              {diferencia !== null && diferencia !== 0 && (
                <span
                  className={`text-xs font-medium ${
                    diferencia > 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {diferencia > 0 ? "+" : ""}
                  {diferencia}
                </span>
              )}
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
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setLineas((prev) => [...prev, { tipoItem: "", itemId: "", cantidadContada: "" }])}
        className="boton-secundario text-xs self-start"
      >
        + Agregar ítem
      </button>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Guardar conteo y ajustar diferencias"}
      </button>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
