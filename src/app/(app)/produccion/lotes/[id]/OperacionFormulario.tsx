"use client";

import { useActionState } from "react";
import { completarOperacion, iniciarOperacion, type EstadoFormulario } from "../actions";

type Props = { operacionId: string; estado: string; equipos: { id: string; codigo: string; nombre: string }[] };

export default function OperacionFormulario({ operacionId, estado, equipos }: Props) {
  const accion = completarOperacion.bind(null, operacionId);
  const [resultado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  if (estado === "PENDIENTE") return <form action={iniciarOperacion.bind(null, operacionId)}><button className="boton-secundario text-xs">Iniciar</button></form>;
  if (estado === "COMPLETADA") return <span className="text-xs text-green-700 dark:text-green-400">Confirmada</span>;
  return (
    <form action={formAction} className="flex flex-wrap gap-2 items-end">
      {resultado.error && <p role="alert" className="w-full text-xs text-red-600">{resultado.error}</p>}
      <select name="equipoId" className="campo-input text-xs"><option value="">Sin equipo</option>{equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.codigo} — {equipo.nombre}</option>)}</select>
      {(["preparacionRealHoras", "maquinaRealHoras", "manoObraRealHoras"] as const).map((campo) => <input key={campo} name={campo} aria-label={campo} type="number" min="0" step="0.01" required defaultValue="0" className="campo-input w-20 text-xs" />)}
      <button disabled={enviando} className="boton-primario text-xs">{enviando ? "Guardando…" : "Confirmar"}</button>
    </form>
  );
}
