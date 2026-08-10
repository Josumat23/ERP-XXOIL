"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

const OPCIONES_MEDIO = [
  { valor: "EFECTIVO", etiqueta: "Efectivo" },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia" },
  { valor: "DEPOSITO", etiqueta: "Depósito" },
  { valor: "YAPE", etiqueta: "Yape" },
  { valor: "PLIN", etiqueta: "Plin" },
  { valor: "OTRO", etiqueta: "Otro" },
];

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valorEnLibros: number;
};

export default function VentaFormulario({ accion, valorEnLibros }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <p className="text-xs text-neutral-500">
        Valor en libros actual: S/ {valorEnLibros.toFixed(2)}. La utilidad o pérdida se postea
        automáticamente comparando ese valor contra el precio de venta sin IGV.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Precio de venta (S/, IGV incluido)
          </span>
          <input
            name="precioVenta"
            type="number"
            step="0.01"
            min="0"
            required
            className="campo-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio de pago</span>
          <select name="medioPago" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {OPCIONES_MEDIO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Comprador / observaciones (opcional)
        </span>
        <textarea name="motivoBaja" rows={2} placeholder="Venta a..." className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar venta"}
      </button>
    </form>
  );
}
