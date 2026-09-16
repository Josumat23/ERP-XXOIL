"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../actions";

type Plan = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  planes: Plan[];
  /** Vida útil del producto contada desde hoy: solo una sugerencia. */
  vencimientoSugerido: string | null;
};

export default function ReanalisisFormulario({ accion, planes, vencimientoSugerido }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-xl">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Resultado del ensayo *</span>
          <select name="resultado" required defaultValue="APROBADO" className="campo-input">
            <option value="APROBADO">Aprobado — sigue en especificación</option>
            <option value="RECHAZADO">Rechazado — fuera de especificación</option>
          </select>
          <span className="text-xs text-slate-500">
            Un ensayo rechazado no puede extender la vigencia; sí acortarla.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Vencimiento nuevo *</span>
          <input
            name="vencimientoNuevo"
            type="date"
            required
            defaultValue={vencimientoSugerido ?? ""}
            className="campo-input"
          />
          {vencimientoSugerido && (
            <span className="text-xs text-slate-500">
              Sugerido: la vida útil del producto desde hoy. Puede cambiarlo.
            </span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Plan de inspección usado</span>
        <select name="planInspeccionId" defaultValue="" className="campo-input">
          <option value="">Sin plan declarado</option>
          {planes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Contra qué se ensayó. Se guarda con su versión: un plan cambia, y el ensayo tiene que
          poder reconstruirse tal como se hizo.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Observaciones</span>
        <textarea name="observaciones" rows={2} className="campo-input" />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando…" : "Registrar re-análisis"}
      </button>
    </form>
  );
}
