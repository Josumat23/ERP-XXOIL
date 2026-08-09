"use client";

import { useActionState } from "react";
import { crearAjuste, type EstadoFormulario } from "./actions";

type Item = { valor: string; etiqueta: string; stock: number };

type Props = {
  presentaciones: Item[];
  insumos: Item[];
};

export default function AjusteFormulario({ presentaciones, insumos }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearAjuste,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Ítem a ajustar</span>
        <select name="item" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          <optgroup label="Presentaciones">
            {presentaciones.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta} (stock: {p.stock})
              </option>
            ))}
          </optgroup>
          <optgroup label="Insumos">
            {insumos.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.etiqueta} (stock: {i.stock})
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Dirección</span>
          <select name="direccion" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="ENTRADA">Entrada (sobra física)</option>
            <option value="SALIDA">Salida (faltante, merma, rotura)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Cantidad</span>
          <input name="cantidad" type="number" step="0.001" min="0" required className="campo-input" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Motivo (obligatorio, queda en auditoría)
        </span>
        <textarea
          name="motivo"
          rows={3}
          required
          placeholder="Ej.: diferencia detectada en inventario físico del 15/07"
          className="campo-input"
        />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar ajuste"}
      </button>
    </form>
  );
}
