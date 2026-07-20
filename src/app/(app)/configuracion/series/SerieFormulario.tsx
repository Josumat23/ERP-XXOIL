"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearSerieDocumento, type EstadoFormulario } from "./actions";

export default function SerieFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearSerieDocumento(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Documento</span>
          <select name="tipoDocumento" required defaultValue="" className="campo-input w-44">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="FACTURA">Factura</option>
            <option value="NOTA_CREDITO">Nota de crédito</option>
            <option value="GUIA_REMISION">Guía de remisión</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Serie</span>
          <input
            name="serie"
            required
            maxLength={4}
            placeholder="F001"
            className="campo-input w-28 font-mono uppercase"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Correlativo inicial
          </span>
          <input
            name="correlativoActual"
            type="number"
            step="1"
            min="0"
            defaultValue={0}
            className="campo-input w-32"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar serie"}
        </button>
      </div>
    </form>
  );
}
