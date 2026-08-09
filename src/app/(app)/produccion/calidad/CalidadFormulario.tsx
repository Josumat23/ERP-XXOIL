"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registrarCalidad, type EstadoFormulario } from "./actions";

type Causa = { id: string; nombre: string };

export default function CalidadFormulario({
  loteId,
  causas,
}: {
  loteId: string;
  causas: Causa[];
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    registrarCalidad,
    {}
  );
  const [resultado, setResultado] = useState("");
  const esRechazo = resultado === "RECHAZADO";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <input type="hidden" name="loteId" value={loteId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Resultado</span>
          <select
            name="resultado"
            required
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            className="campo-input w-40"
          >
            <option value="" disabled>
              Seleccione
            </option>
            <option value="APROBADO">Aprobar</option>
            <option value="RECHAZADO">Rechazar</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Observaciones (obligatorias si rechaza)
          </span>
          <input name="observaciones" className="campo-input" />
        </label>
      </div>
      {esRechazo && (
        <div className="flex flex-wrap items-end gap-3 border-t border-black/10 dark:border-white/10 pt-3">
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Causa (catálogo)</span>
            <select name="causaId" required={esRechazo} className="campo-input">
              <option value="">Seleccione</option>
              {causas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Detalle adicional (opcional)
            </span>
            <input
              name="causaRaiz"
              placeholder="Ej.: lote 12-A, contaminación cruzada con..."
              className="campo-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Acción correctiva
            </span>
            <input
              name="accionCorrectiva"
              placeholder="Ej.: reproceso, descarte, ajuste de fórmula..."
              className="campo-input"
            />
          </label>
        </div>
      )}
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar resultado"}
      </button>
    </form>
  );
}
