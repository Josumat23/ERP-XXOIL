"use client";

import { useActionState, useRef } from "react";
import { crearInstrumento, type EstadoFormulario } from "./actions";

export default function InstrumentoFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await crearInstrumento(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Instrumento agregado.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Código</span>
          <input name="codigo" required placeholder="DM-01" className="campo-input w-28" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Instrumento</span>
          <input name="nombre" required placeholder="Densímetro digital" className="campo-input w-56" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Marca</span>
          <input name="marca" className="campo-input w-36" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Modelo</span>
          <input name="modelo" className="campo-input w-36" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Serie</span>
          <input name="serie" className="campo-input w-36" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ubicación</span>
          <input name="ubicacion" placeholder="Laboratorio" className="campo-input w-40" />
        </label>
        {/*
          Opcional a propósito: es una ayuda para planificar. La vigencia que
          manda es la del certificado de cada calibración, no este número.
        */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Frecuencia (días)</span>
          <input
            name="frecuenciaCalibracionDias"
            type="number"
            min="1"
            step="1"
            placeholder="365"
            className="campo-input w-32"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : "Agregar"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        La frecuencia solo sirve para sugerir la próxima fecha. Lo que define hasta cuándo rige una
        calibración es su certificado.
      </p>
    </form>
  );
}
