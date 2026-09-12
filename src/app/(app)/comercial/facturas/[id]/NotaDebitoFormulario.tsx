"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../actions";

type Serie = { id: string; serie: string; sugerido: string };

export default function NotaDebitoFormulario({
  accion,
  series,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  series: Serie[];
}) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {estado.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        {series.length > 0 && (
          <select name="serieId" defaultValue="" className="campo-input text-xs w-28">
            <option value="">Sin serie</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.serie}
              </option>
            ))}
          </select>
        )}
        <input
          name="numero"
          placeholder={series[0]?.sugerido ?? "ND-00001"}
          className="campo-input text-xs w-40 font-mono"
        />
        <button type="submit" disabled={enviando} className="boton-secundario text-xs">
          {enviando ? "Emitiendo…" : "Emitir nota de débito"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Documenta este recargo. No vuelve a cargarlo: el saldo de la factura y el asiento ya se
        movieron cuando se aplicó.
      </p>
    </form>
  );
}
