"use client";

import { useActionState } from "react";
import { registrarPagoProveedor, type EstadoFormulario } from "../actions";

export default function PagoFormulario({ cuentaId, saldo }: { cuentaId: string; saldo: number }) {
  const accion = registrarPagoProveedor.bind(null, cuentaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Monto (saldo: S/ {saldo.toFixed(2)})
          </span>
          <input
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            max={saldo}
            required
            className="campo-input w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio de pago</span>
          <select name="medioPago" required defaultValue="" className="campo-input w-44">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="DEPOSITO">Depósito</option>
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Referencia</span>
          <input name="referencia" className="campo-input" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar pago"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">El pago genera un egreso automático en el libro de caja.</p>
    </form>
  );
}
