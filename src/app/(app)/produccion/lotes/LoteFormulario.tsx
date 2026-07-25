"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearLote, type EstadoFormulario } from "./actions";

type FormulaOpcion = {
  id: string;
  etiqueta: string;
  rendimientoKg: number;
  detalles: { nombre: string; unidad: string; cantidad: number; stock: number }[];
};

export default function LoteFormulario({ formulas }: { formulas: FormulaOpcion[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(crearLote, {});
  const [formulaId, setFormulaId] = useState("");
  const [kgObjetivo, setKgObjetivo] = useState("");

  const formula = formulas.find((f) => f.id === formulaId);
  const factor = formula && Number(kgObjetivo) > 0 ? Number(kgObjetivo) / formula.rendimientoKg : 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fórmula</span>
          <select
            name="formulaId"
            required
            value={formulaId}
            onChange={(e) => setFormulaId(e.target.value)}
            className="campo-input"
          >
            <option value="" disabled>
              Seleccione
            </option>
            {formulas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Kg objetivo</span>
          <input
            name="kgObjetivo"
            type="number"
            step="0.01"
            min="0"
            required
            value={kgObjetivo}
            onChange={(e) => setKgObjetivo(e.target.value)}
            className="campo-input"
          />
        </label>
      </div>

      {formula && factor > 0 && (
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Consumo estimado de insumos
          </p>
          <table className="tabla">
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="text-right">Se consumirá</th>
                <th className="text-right">Stock actual</th>
              </tr>
            </thead>
            <tbody>
              {formula.detalles.map((d, i) => {
                const consumo = d.cantidad * factor;
                const insuficiente = consumo > d.stock;
                return (
                  <tr key={i}>
                    <td>{d.nombre}</td>
                    <td
                      className={`text-right ${
                        insuficiente ? "text-red-600 dark:text-red-400 font-medium" : ""
                      }`}
                    >
                      {consumo.toLocaleString("es-PE", { maximumFractionDigits: 3 })} {d.unidad}
                    </td>
                    <td className="text-right text-neutral-500">
                      {d.stock.toLocaleString("es-PE", { maximumFractionDigits: 3 })} {d.unidad}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Observaciones (opcional)
        </span>
        <textarea name="observaciones" rows={2} className="campo-input" />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando lote..." : "Crear lote y consumir insumos"}
      </button>
    </form>
  );
}
