"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearMovimientoCaja, type EstadoFormulario } from "./actions";

export default function CajaFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearMovimientoCaja(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <select name="tipo" aria-label="Tipo de movimiento" required defaultValue="" className="campo-input w-32">
          <option value="" disabled>
            Tipo
          </option>
          <option value="INGRESO">Ingreso</option>
          <option value="EGRESO">Egreso</option>
        </select>
        <input
          name="concepto"
          aria-label="Concepto"
          required
          placeholder="Concepto (ej. compra de repuestos, aporte de capital)"
          className="campo-input flex-1 min-w-64"
        />
        <input
          name="monto"
          aria-label="Monto en soles"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Monto S/"
          className="campo-input w-32"
        />
        <select name="medioPago" aria-label="Medio de pago" required defaultValue="" className="campo-input w-40">
          <option value="" disabled>
            Medio
          </option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="DEPOSITO">Depósito</option>
          <option value="YAPE">Yape</option>
          <option value="PLIN">Plin</option>
          <option value="OTRO">Otro</option>
        </select>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar"}
        </button>
      </div>
    </form>
  );
}
