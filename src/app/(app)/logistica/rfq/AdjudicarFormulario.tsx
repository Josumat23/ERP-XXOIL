"use client";
import { useActionState } from "react";
import { adjudicarOferta, type EstadoRfqFormulario } from "./actions";
export default function AdjudicarFormulario({ rfqId, ofertaId }: { rfqId: string; ofertaId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoRfqFormulario, FormData>(adjudicarOferta.bind(null, rfqId, ofertaId), {});
  return <form action={accion} className="mt-3 space-y-2"><textarea name="justificacion" required minLength={12} placeholder="Justificación obligatoria de la adjudicación" className="campo-input w-full" />{estado.error && <p className="text-sm text-red-600">{estado.error}</p>}<button disabled={pendiente} className="boton-primario">Adjudicar y crear OC</button></form>;
}
