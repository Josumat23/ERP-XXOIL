"use client";
import { useActionState } from "react";
import { registrarAsistencia, type EstadoFormulario } from "./actions";

export default function AsistenciaFormulario({ empleados }: { empleados: { id: string; etiqueta: string }[] }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(registrarAsistencia, {});
  const hoy = new Date().toLocaleDateString("en-CA");
  return <form action={accion} className="tarjeta mb-5 grid gap-3 p-4 md:grid-cols-6">
    <h2 className="font-semibold md:col-span-6">Registrar jornada</h2>
    {estado.error && <p role="alert" className="text-sm text-red-600 md:col-span-6">{estado.error}</p>}
    {estado.exito && <p role="status" className="text-sm text-green-700 md:col-span-6">{estado.exito}</p>}
    <label className="text-sm md:col-span-2">Empleado<select required name="empleadoId" className="campo-input mt-1 w-full"><option value="">Seleccione…</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}</select></label>
    <label className="text-sm">Fecha<input required name="fecha" type="date" defaultValue={hoy} className="campo-input mt-1 w-full" /></label>
    <label className="text-sm">Entrada<input name="entrada" type="time" className="campo-input mt-1 w-full" /></label>
    <label className="text-sm">Salida<input name="salida" type="time" className="campo-input mt-1 w-full" /></label>
    <label className="flex items-end gap-2 pb-2 text-sm"><input name="ausenciaJustificada" type="checkbox" /> Ausencia justificada</label>
    <label className="text-sm md:col-span-5">Observación<input name="observacion" className="campo-input mt-1 w-full" maxLength={300} /></label>
    <button disabled={enviando} className="boton-primario">{enviando ? "Guardando…" : "Guardar borrador"}</button>
  </form>;
}
