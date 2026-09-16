"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../actions";

type Recepcion = { id: string; etiqueta: string; disponibleKg: number };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  recepciones: Recepcion[];
};

export default function DescargarFormulario({ accion, recepciones }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  if (recepciones.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        No hay recepciones de este insumo con saldo disponible para descargar.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-xl">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Recepción a descargar *</span>
        <select name="recepcionCompraDetalleId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {recepciones.map((r) => (
            <option key={r.id} value={r.id}>
              {r.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Cantidad (kg) *</span>
        <input
          name="cantidadKg"
          type="number"
          step="0.001"
          min="0"
          required
          className="campo-input w-48"
        />
        <span className="text-xs text-slate-500">
          El saldo deja de estar disponible como envase suelto y pasa a ser parte del contenido del
          tanque.
        </span>
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Descargando…" : "Descargar en el tanque"}
      </button>
    </form>
  );
}
