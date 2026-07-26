"use client";

import { useActionState } from "react";
import { actualizarSupuestosMarketing, type EstadoFormulario } from "../actions";

export default function SupuestosMarketingFormulario({
  proyeccionId,
  crecimientoMercadoPct,
  factorCompetenciaPct,
  presupuestoPublicidad,
}: {
  proyeccionId: string;
  crecimientoMercadoPct: number;
  factorCompetenciaPct: number;
  presupuestoPublicidad: number;
}) {
  const accion = actualizarSupuestosMarketing.bind(null, proyeccionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {estado.error && (
        <p className="sm:col-span-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <Campo etiqueta="Crecimiento de mercado esperado (%)">
        <input name="crecimientoMercadoPct" type="number" step="0.1" defaultValue={crecimientoMercadoPct} className="campo-input" />
      </Campo>
      <Campo etiqueta="Factor de competencia (−/+ %)">
        <input name="factorCompetenciaPct" type="number" step="0.1" defaultValue={factorCompetenciaPct} className="campo-input" />
      </Campo>
      <Campo etiqueta="Presupuesto de publicidad (S/)">
        <input name="presupuestoPublicidad" type="number" step="0.01" min="0" defaultValue={presupuestoPublicidad} className="campo-input" />
      </Campo>
      <div className="sm:col-span-3">
        <button type="submit" disabled={enviando} className="boton-secundario text-sm">
          {enviando ? "Guardando..." : "Guardar supuestos"}
        </button>
      </div>
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
