"use client";

import { useActionState, useRef } from "react";
import { crearProductoCompetencia, type EstadoFormulario } from "./actions";

export default function CompetenciaFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await crearProductoCompetencia(prev, formData);
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
          Agregado.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Marca</span>
          <input name="marca" required placeholder="Mobil" className="campo-input w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Producto</span>
          <input name="nombre" required placeholder="Delvac 1340" className="campo-input w-52" />
        </label>
        {/*
          Sin la fuente, dentro de dos años nadie sabrá contra qué se comparó:
          lo que se guarda acá no son hechos verificados por XXOIL sino lo que
          la literatura del competidor declara, y eso cambia con cada revisión.
        */}
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
          <span className="font-medium">Fuente</span>
          <input
            name="fuente"
            placeholder="Ficha técnica del fabricante, rev. 2026-03"
            className="campo-input w-full"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : "Agregar"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        Lo que se carga acá es lo que <strong>la ficha del competidor declara</strong>, no algo que
        XXOIL haya verificado. Por eso conviene anotar de dónde salió.
      </p>
    </form>
  );
}
