"use client";

import { useActionState } from "react";
import { rechazarCambioSalarial, type EstadoFormulario } from "../actions";

export default function RechazarCambioSalarialFormulario({ cambioId }: { cambioId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(rechazarCambioSalarial.bind(null, cambioId), {});
  return <form action={accion} className="mt-2 flex flex-wrap gap-2">
    {estado.error && <p role="alert" className="w-full text-xs text-red-600">{estado.error}</p>}
    <input required name="motivo" maxLength={300} aria-label="Motivo del rechazo salarial" placeholder="Motivo del rechazo" className="campo-input min-w-40 flex-1 text-xs" />
    <button disabled={enviando} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">{enviando ? "Rechazando…" : "Rechazar"}</button>
  </form>;
}
