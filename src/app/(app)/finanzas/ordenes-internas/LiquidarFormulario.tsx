"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  centrosCosto: Opcion[];
  centroCostoSugeridoId: string | null;
  totalAcumulado: number;
};

export default function LiquidarFormulario({
  accion,
  centrosCosto,
  centroCostoSugeridoId,
  totalAcumulado,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Centro de costo de destino
        </span>
        <select name="centroCostoId" required defaultValue={centroCostoSugeridoId ?? ""} className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando
          ? "Liquidando..."
          : `Liquidar ${totalAcumulado.toLocaleString("es-PE", { style: "currency", currency: "PEN" })}`}
      </button>
    </form>
  );
}
