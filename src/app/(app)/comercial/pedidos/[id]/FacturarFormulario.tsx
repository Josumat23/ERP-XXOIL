"use client";

import { useActionState } from "react";
import { facturarPedido, type EstadoFormulario } from "../actions";

export default function FacturarFormulario({
  pedidoId,
  condicionDefecto = "",
}: {
  pedidoId: string;
  condicionDefecto?: string;
}) {
  const accion = facturarPedido.bind(null, pedidoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            N° factura SUNAT
          </span>
          <input
            name="numero"
            required
            placeholder="F001-00000123"
            className="campo-input font-mono w-48"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Condición de pago</span>
          <select name="condicionPago" required defaultValue={condicionDefecto} className="campo-input w-44">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="CONTADO">Contado</option>
            <option value="DIAS_15">Crédito 15 días</option>
            <option value="DIAS_30">Crédito 30 días</option>
          </select>
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Facturando..." : "Registrar factura"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        La factura se emite en el portal SUNAT; aquí se registra su número. Al registrar se descuenta
        el stock y se genera la comisión del vendedor.
      </p>
    </form>
  );
}
