"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearAsientoManual, type EstadoFormulario } from "./actions";

type Cuenta = { id: string; etiqueta: string };
type Linea = { cuentaId: string; glosa: string; debe: string; haber: string };

export default function AsientoManualFormulario({ cuentas }: { cuentas: Cuenta[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearAsientoManual,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([
    { cuentaId: "", glosa: "", debe: "", haber: "" },
    { cuentaId: "", glosa: "", debe: "", haber: "" },
  ]);

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({
      cuentaId: l.cuentaId,
      glosa: l.glosa,
      debe: Number(l.debe) || 0,
      haber: Number(l.haber) || 0,
    }))
  );

  const totalDebe = lineas.reduce((acc, l) => acc + (Number(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((acc, l) => acc + (Number(l.haber) || 0), 0);
  const cuadrado = Math.round(totalDebe * 100) === Math.round(totalHaber * 100);

  function actualizar(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha</span>
          <input name="fecha" type="date" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Glosa *</span>
          <input name="glosa" required placeholder="Descripción del asiento" className="campo-input" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {lineas.map((linea, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <select
              value={linea.cuentaId}
              onChange={(e) => actualizar(idx, { cuentaId: e.target.value })}
              className="campo-input flex-1"
            >
              <option value="" disabled>
                Cuenta
              </option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
            <input
              placeholder="Glosa línea"
              value={linea.glosa}
              onChange={(e) => actualizar(idx, { glosa: e.target.value })}
              className="campo-input w-44"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Debe"
              value={linea.debe}
              onChange={(e) => actualizar(idx, { debe: e.target.value, haber: e.target.value ? "" : linea.haber })}
              className="campo-input w-28 text-right"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Haber"
              value={linea.haber}
              onChange={(e) => actualizar(idx, { haber: e.target.value, debe: e.target.value ? "" : linea.debe })}
              className="campo-input w-28 text-right"
            />
            <button
              type="button"
              onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
              disabled={lineas.length <= 2}
              className="text-neutral-400 hover:text-red-500 disabled:opacity-30 px-2"
              aria-label="Quitar línea"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setLineas((prev) => [...prev, { cuentaId: "", glosa: "", debe: "", haber: "" }])}
        className="boton-secundario self-start text-xs"
      >
        + Agregar línea
      </button>

      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4">
        <p className={`text-sm font-medium ${cuadrado ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          Debe: S/ {totalDebe.toFixed(2)} · Haber: S/ {totalHaber.toFixed(2)}{" "}
          {cuadrado ? "✓ cuadrado" : "✗ descuadrado"}
        </p>
        <button type="submit" disabled={enviando || !cuadrado} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar asiento"}
        </button>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
