"use client";

import { useActionState } from "react";
import { guardarDescuentoCanal, type EstadoFormulario } from "./actions";
import type { $Enums } from "@/generated/prisma/client";

export default function DescuentoCanalFormulario({
  canal,
  descuentoPct,
}: {
  canal: $Enums.CanalCliente;
  descuentoPct: number;
}) {
  const accion = guardarDescuentoCanal.bind(null, canal);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex items-end gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Descuento (%)</span>
        <input
          name="descuentoPct"
          type="number"
          step="0.1"
          min="0"
          max="100"
          defaultValue={descuentoPct}
          className="campo-input w-28"
        />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario">
        {enviando ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
