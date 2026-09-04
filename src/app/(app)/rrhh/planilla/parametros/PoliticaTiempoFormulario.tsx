"use client";
import { useActionState } from "react";
import { crearPoliticaTiempo, type EstadoFormulario } from "./actions";
export default function PoliticaTiempoFormulario() {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(crearPoliticaTiempo, {});
  return <form action={accion} className="tarjeta grid gap-3 p-4 md:grid-cols-6">
    {estado.error && <p role="alert" className="text-sm text-red-600 md:col-span-6">{estado.error}</p>}
    {estado.ok && <p role="status" className="text-sm text-green-700 md:col-span-6">Política guardada como borrador.</p>}
    <label className="text-sm">Vigente desde<input required name="vigenteDesde" type="date" className="campo-input mt-1 w-full" /></label>
    <label className="text-sm">Jornada diaria<input required name="horasJornadaDiaria" type="number" min="1" max="12" step="0.25" defaultValue="8" className="campo-input mt-1 w-full" /></label>
    <label className="text-sm">Primer tramo (h)<input required name="primerasHorasRecargo" type="number" min="0" max="8" step="0.25" defaultValue="2" className="campo-input mt-1 w-full" /></label>
    <label className="text-sm">Recargo tramo 1 (%)<input required name="recargoPrimerTramo" type="number" min="25" max="200" step="0.01" defaultValue="25" className="campo-input mt-1 w-full" /></label>
    <label className="text-sm">Recargo tramo 2 (%)<input required name="recargoSegundoTramo" type="number" min="35" max="200" step="0.01" defaultValue="35" className="campo-input mt-1 w-full" /></label>
    <label className="flex items-end gap-2 pb-2 text-sm"><input name="aplicarPagoSobretiempo" type="checkbox" /> Aplicar en planilla</label>
    <button disabled={enviando} className="boton-primario md:col-span-2">{enviando ? "Guardando…" : "Crear borrador"}</button>
  </form>;
}
