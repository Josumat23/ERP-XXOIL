"use client";

import { useActionState } from "react";
import { registrarDevolucionProveedor, type EstadoFormulario } from "../actions";

type Linea = { id: string; nombre: string; disponible: number; unidad: string };

export default function DevolucionProveedorFormulario({
  ordenCompraId,
  lineas,
}: {
  ordenCompraId: string;
  lineas: Linea[];
}) {
  const accion = registrarDevolucionProveedor.bind(null, ordenCompraId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {estado.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Línea recibida</span>
        <select name="recepcionCompraDetalleId" required className="campo-input">
          <option value="">Seleccione...</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre} (disponible: {l.disponible} {l.unidad})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Cantidad</span>
        <input name="cantidad" type="number" step="0.001" min="0" required className="campo-input w-28" />
      </label>
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo (obligatorio)</span>
        <input name="motivo" required className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Registrando..." : "Devolver a proveedor"}
      </button>
      <p className="w-full text-xs text-neutral-500">
        Reduce el stock del insumo y se aplica como crédito contra la cuenta por pagar generada por
        esa recepción.
      </p>
    </form>
  );
}
