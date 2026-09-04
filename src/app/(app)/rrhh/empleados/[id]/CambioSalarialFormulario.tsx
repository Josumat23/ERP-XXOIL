"use client";
import { useActionState } from "react";
import { solicitarCambioSalarial, type EstadoFormulario } from "../actions";
export default function CambioSalarialFormulario({ empleadoId }: { empleadoId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(solicitarCambioSalarial.bind(null, empleadoId), {});
  return <form action={accion} className="grid gap-3 md:grid-cols-4"><h3 className="font-medium md:col-span-4">Solicitar cambio salarial</h3>{estado.error && <p role="alert" className="text-sm text-red-600 md:col-span-4">{estado.error}</p>}<label className="text-sm">Nuevo sueldo<input required name="sueldoNuevo" type="number" min="0.01" step="0.01" className="campo-input mt-1 w-full" /></label><label className="text-sm">Vigente desde<input required name="vigenteDesde" type="date" max={new Date().toLocaleDateString("en-CA")} className="campo-input mt-1 w-full" /></label><label className="text-sm md:col-span-2">Motivo<input required name="motivo" maxLength={300} className="campo-input mt-1 w-full" /></label><button disabled={enviando} className="boton-primario md:col-span-1">{enviando ? "Enviando…" : "Solicitar"}</button></form>;
}
