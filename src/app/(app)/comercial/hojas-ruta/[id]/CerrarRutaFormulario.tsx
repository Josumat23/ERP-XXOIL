"use client";

import { useActionState } from "react";
import { cerrarHojaRuta, type EstadoFormulario } from "../actions";

type Visita = { id: string; orden: number; cliente: string; objetivo: string | null };

export default function CerrarRutaFormulario({
  hojaId,
  visitas,
}: {
  hojaId: string;
  visitas: Visita[];
}) {
  const accion = cerrarHojaRuta.bind(null, hojaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {visitas.map((v) => (
          <label key={v.id} className="flex items-center gap-3 text-sm">
            <span className="w-64 shrink-0 truncate">
              {v.orden}. {v.cliente}
              {v.objetivo ? ` — ${v.objetivo}` : ""}
            </span>
            <input
              name={`resultado_${v.id}`}
              placeholder="Resultado de la visita"
              className="campo-input flex-1"
            />
          </label>
        ))}
      </div>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Cerrando..." : "Cerrar ruta con resultados"}
      </button>
    </form>
  );
}
