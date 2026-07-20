"use client";

import { useState } from "react";

type Serie = { id: string; serie: string; correlativoActual: number };

function sugerirNumero(serie: string, correlativo: number): string {
  return `${serie}-${String(correlativo).padStart(8, "0")}`;
}

// Selector de serie SUNAT + número sugerido editable. Si no hay series
// configuradas (o el usuario elige "Escribir manualmente"), el campo queda
// como texto libre, igual que antes de tener Configuración → Series.
export default function SelectorSerieNumero({
  series,
  etiquetaNumero = "Número de documento",
}: {
  series: Serie[];
  etiquetaNumero?: string;
}) {
  const [serieId, setSerieId] = useState("");
  const [numero, setNumero] = useState("");

  function elegirSerie(id: string) {
    setSerieId(id);
    const serie = series.find((s) => s.id === id);
    if (serie) setNumero(sugerirNumero(serie.serie, serie.correlativoActual + 1));
  }

  return (
    <div className="flex gap-3 items-end">
      {series.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Serie</span>
          <select
            value={serieId}
            onChange={(e) => elegirSerie(e.target.value)}
            className="campo-input w-40"
          >
            <option value="">Escribir manualmente</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.serie}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm flex-1">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiquetaNumero}</span>
        <input
          name="numero"
          required
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="F001-00000123"
          className="campo-input font-mono"
        />
      </label>
      <input type="hidden" name="serieId" value={serieId} />
    </div>
  );
}
