"use client";

import { useActionState, useState } from "react";
import { ETIQUETA_TIPO_MANUAL, TIPOS_MANUALES, calcularImporte } from "@/lib/notaDebitoManual";
import type { EstadoFormulario } from "../actions";

type Serie = { id: string; serie: string; sugerido: string };

export default function NotaDebitoManualFormulario({
  accion,
  series,
  tasaIgv,
  moneda,
}: {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  series: Serie[];
  tasaIgv: number;
  moneda: string;
}) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  const [base, setBase] = useState(0);
  const [afecto, setAfecto] = useState<"SI" | "NO" | "">("");

  // Vista previa del total. El cálculo de verdad lo rehace el servidor con la
  // tasa de la compañía: esto es comodidad de pantalla.
  const previa = afecto === "" ? null : calcularImporte(base, afecto === "SI", tasaIgv);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
          <select name="tipoNota" defaultValue="" required className="campo-input">
            <option value="" disabled>
              Seleccione…
            </option>
            {TIPOS_MANUALES.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_MANUAL[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Importe sin IGV ({moneda})
          </span>
          <input
            name="baseImponible"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="campo-input"
            onChange={(e) => setBase(Number(e.target.value))}
          />
        </label>
      </div>

      <fieldset className="flex flex-wrap items-center gap-4 text-sm">
        <legend className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          ¿El concepto está afecto al IGV?
        </legend>
        {(["SI", "NO"] as const).map((valor) => (
          <label key={valor} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="afectoIgv"
              value={valor}
              required
              checked={afecto === valor}
              onChange={() => setAfecto(valor)}
            />
            <span>{valor === "SI" ? "Sí" : "No"}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-neutral-500 -mt-2">
        Sin valor por defecto a propósito: que un concepto esté afecto es criterio tributario y no
        es el mismo para un ajuste de precio que para una penalidad. Lo declara quien emite.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo</span>
        <textarea
          name="motivo"
          rows={2}
          required
          maxLength={500}
          className="campo-input"
          placeholder="Qué se cobra y por qué: es lo que sustenta el documento ante el cliente y ante SUNAT"
        />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        {series.length > 0 && (
          <select name="serieId" defaultValue="" className="campo-input text-xs w-28">
            <option value="">Sin serie</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.serie}
              </option>
            ))}
          </select>
        )}
        <input
          name="numero"
          placeholder={series[0]?.sugerido ?? "ND-00001"}
          className="campo-input text-xs w-40 font-mono"
        />
        <button type="submit" disabled={enviando} className="boton-primario text-sm">
          {enviando ? "Emitiendo…" : "Emitir nota de débito"}
        </button>
      </div>

      {previa && previa.baseImponible > 0 && (
        <p className="text-xs text-neutral-500">
          Base {previa.baseImponible.toFixed(2)} + IGV {previa.igv.toFixed(2)} ={" "}
          <strong>{previa.total.toFixed(2)}</strong> {moneda}, que se sumará al saldo de la factura.
        </p>
      )}
      <p className="text-xs text-neutral-500">
        A diferencia de la nota por mora, esta <strong>sí</strong> aumenta el saldo de la factura y
        genera su asiento: el recargo por mora ya estaba cobrado cuando se aplicó, y esto todavía no
        existía.
      </p>
    </form>
  );
}
