"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearTasaAfp } from "./actions";

export default function TasaAfpFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: { error?: string; ok?: boolean }, formData: FormData) => {
      const resultado = await crearTasaAfp(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 max-w-3xl">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Guardado.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <Campo etiqueta="AFP">
          <select name="afp" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="INTEGRA">Integra</option>
            <option value="PRIMA">Prima</option>
            <option value="HABITAT">Habitat</option>
            <option value="PROFUTURO">Profuturo</option>
          </select>
        </Campo>
        <Campo etiqueta="Tipo comisión">
          <select name="tipoComision" defaultValue="FLUJO" className="campo-input">
            <option value="FLUJO">Flujo</option>
            <option value="MIXTA">Mixta</option>
          </select>
        </Campo>
        <Campo etiqueta="Aporte (%)">
          <input name="tasaAporteObligatorio" type="number" step="0.01" min="0" defaultValue={10} className="campo-input" />
        </Campo>
        <Campo etiqueta="Comisión (%)">
          <input name="tasaComision" type="number" step="0.01" min="0" required className="campo-input" />
        </Campo>
        <Campo etiqueta="Prima seguro (%)">
          <input name="primaSeguro" type="number" step="0.01" min="0" required className="campo-input" />
        </Campo>
        <Campo etiqueta="Vigente desde">
          <input name="vigenteDesde" type="date" required className="campo-input" />
        </Campo>
      </div>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Agregar tasa"}
      </button>
    </form>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}
