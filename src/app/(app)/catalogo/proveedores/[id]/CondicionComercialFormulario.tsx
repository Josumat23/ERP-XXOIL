"use client";

import { useRef } from "react";
import { useActionState } from "react";
import type { EstadoFormulario } from "../actions";

export default function CondicionComercialFormulario({
  accion,
  diasVigentes,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  diasVigentes: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm w-36">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Plazo (días)</span>
          <input
            name="condicionPagoDias"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={diasVigentes ?? 0}
            className="campo-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Rige desde</span>
          <input name="vigenteDesde" type="date" required defaultValue={hoy} className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Motivo del cambio
          </span>
          <input
            name="motivo"
            required
            maxLength={500}
            placeholder="Negociación anual, volumen acordado, corrección…"
            className="campo-input"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Registrando…" : "Registrar condición"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        Registrar una condición nueva cierra la anterior en esa misma fecha. El plazo vigente pasa a
        ser el que use el sistema; el historial queda para poder responder qué regía cuando se
        recibió una factura, y por qué cambió.
      </p>
    </form>
  );
}
