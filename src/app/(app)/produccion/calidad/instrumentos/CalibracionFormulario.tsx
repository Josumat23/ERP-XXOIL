"use client";

import { useActionState, useRef } from "react";
import type { EstadoFormulario } from "./actions";

type Accion = (prev: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export default function CalibracionFormulario({
  accion,
  vigenteHastaSugerido,
}: {
  accion: Accion;
  /** Fecha sugerida por la frecuencia del instrumento; `null` si no declaró
   *  ninguna. Es una sugerencia: quien registra la cambia por la del papel. */
  vigenteHastaSugerido: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
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
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fecha</span>
          <input name="fecha" type="date" required defaultValue={hoy} className="campo-input w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Vigente hasta</span>
          <input
            name="vigenteHasta"
            type="date"
            required
            defaultValue={vigenteHastaSugerido ?? ""}
            className="campo-input w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Resultado</span>
          <select name="resultado" required defaultValue="CONFORME" className="campo-input w-48">
            <option value="CONFORME">Conforme</option>
            <option value="CONFORME_CON_AJUSTE">Conforme con ajuste</option>
            <option value="NO_CONFORME">Fuera de tolerancia</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">N.º de certificado</span>
          <input name="numeroCertificado" required className="campo-input w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Quién calibró</span>
          <input name="entidad" required placeholder="Laboratorio acreditado" className="campo-input w-48" />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
          <span className="font-medium">Observaciones</span>
          <input name="observaciones" placeholder="Opcional" className="campo-input w-full" />
        </label>
        <button type="submit" disabled={enviando} className="boton-secundario">
          {enviando ? "Guardando..." : "Registrar calibración"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        Cada calibración se agrega al historial y no se edita: el estado de hoy sale de la más
        reciente. <strong>Fuera de tolerancia</strong> deja el instrumento inutilizable aunque la
        fecha siga vigente — qué hacer con los ensayos ya hechos con él lo decide calidad.
      </p>
    </form>
  );
}
