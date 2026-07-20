"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearOrdenCompra, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };
type InsumoOpcion = { id: string; etiqueta: string; costo: number; unidad: string };

type Linea = { insumoId: string; cantidad: string; costoUnitario: string };

type Props = {
  proveedores: Opcion[];
  insumos: InsumoOpcion[];
};

export default function OrdenCompraFormulario({ proveedores, insumos }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearOrdenCompra,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([
    { insumoId: "", cantidad: "", costoUnitario: "" },
  ]);

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({
      insumoId: l.insumoId,
      cantidad: Number(l.cantidad),
      costoUnitario: Number(l.costoUnitario),
    }))
  );

  const total = lineas.reduce((acc, l) => {
    const c = Number(l.cantidad);
    const p = Number(l.costoUnitario);
    return acc + (Number.isFinite(c) && Number.isFinite(p) ? c * p : 0);
  }, 0);

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

      <label className="flex flex-col gap-1 text-sm max-w-md">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Proveedor</span>
        <select name="proveedorId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Insumos a comprar
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                value={linea.insumoId}
                onChange={(e) => {
                  const insumo = insumos.find((i) => i.id === e.target.value);
                  actualizarLinea(idx, {
                    insumoId: e.target.value,
                    costoUnitario: insumo ? String(insumo.costo) : linea.costoUnitario,
                  });
                }}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione insumo
                </option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.etiqueta}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                className="campo-input w-24"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo S/"
                value={linea.costoUnitario}
                onChange={(e) => actualizarLinea(idx, { costoUnitario: e.target.value })}
                className="campo-input w-28"
              />
              <span className="w-28 text-right text-sm text-neutral-500">
                {(Number(linea.cantidad) * Number(linea.costoUnitario) || 0).toLocaleString(
                  "es-PE",
                  { style: "currency", currency: "PEN" }
                )}
              </span>
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
          onClick={() =>
            setLineas((prev) => [...prev, { insumoId: "", cantidad: "", costoUnitario: "" }])
          }
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar línea
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas (opcional)</span>
        <textarea name="notas" rows={2} className="campo-input" />
      </label>

      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4">
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Total: {total.toLocaleString("es-PE", { style: "currency", currency: "PEN" })}
        </p>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Crear orden de compra"}
        </button>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
