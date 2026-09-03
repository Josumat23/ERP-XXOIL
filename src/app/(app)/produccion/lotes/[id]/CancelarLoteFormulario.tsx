"use client";

import { useActionState } from "react";
import { cancelarLote, type EstadoFormulario } from "../actions";

export default function CancelarLoteFormulario({ loteId }: { loteId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(cancelarLote.bind(null, loteId), {});
  return <form action={accion} className="flex flex-col gap-2 mt-4"><label className="text-sm"><span className="block font-medium mb-1">Motivo de cancelación</span><textarea name="motivo" minLength={5} maxLength={500} required rows={2} className="campo-input w-full" /></label>{estado.error && <p role="alert" className="text-sm text-red-600">{estado.error}</p>}<button disabled={enviando} className="boton-secundario self-start text-red-700">{enviando ? "Cancelando…" : "Cancelar orden y liberar reservas"}</button></form>;
}
