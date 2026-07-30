"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

export default function EmpresaFormulario({
  accion,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Razón social</span>
        <input name="razonSocial" required className="campo-input" />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">RUC / N° fiscal</span>
          <input name="ruc" className="campo-input font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">País</span>
          <input name="pais" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Moneda funcional</span>
          <select name="monedaFuncional" defaultValue="PEN" className="campo-input">
            <option value="PEN">PEN — Sol</option>
            <option value="USD">USD — Dólar</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando..." : "Crear compañía"}
      </button>
    </form>
  );
}
