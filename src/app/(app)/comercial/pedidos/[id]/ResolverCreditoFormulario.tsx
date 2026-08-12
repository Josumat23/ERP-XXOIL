"use client";

import { useActionState } from "react";
import { rechazarCreditoPedido, type EstadoFormulario } from "../actions";

export default function ResolverCreditoFormulario({ pedidoId }: { pedidoId: string }) {
  const accion = rechazarCreditoPedido.bind(null, pedidoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo del rechazo</span>
        <input
          name="motivo"
          required
          maxLength={500}
          className="campo-input w-72"
          placeholder="Indique el fundamento"
        />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-sm text-red-700 dark:text-red-400">
        {enviando ? "Rechazando..." : "Rechazar excepción"}
      </button>
      {estado.error && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{estado.error}</p>}
    </form>
  );
}