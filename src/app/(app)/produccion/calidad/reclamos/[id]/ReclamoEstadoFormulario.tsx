"use client";

import { useRef, useState, useTransition } from "react";
import { actualizarEstadoReclamo } from "../actions";

export default function ReclamoEstadoFormulario({
  reclamoId,
  estado,
  accionCorrectivaActual,
}: {
  reclamoId: string;
  estado: "ABIERTO" | "EN_PROCESO" | "CERRADO";
  accionCorrectivaActual: string | null;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const accionRef = useRef<HTMLTextAreaElement>(null);

  if (estado === "CERRADO") return null;

  function enviar(nuevoEstado: "EN_PROCESO" | "CERRADO") {
    setError(null);
    const formData = new FormData();
    formData.set("estado", nuevoEstado);
    formData.set("accionCorrectiva", accionRef.current?.value ?? "");
    iniciar(async () => {
      const resultado = await actualizarEstadoReclamo(reclamoId, {}, formData);
      if (resultado.error) setError(resultado.error);
    });
  }

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Acción correctiva (obligatoria para cerrar)
        </span>
        <textarea
          ref={accionRef}
          defaultValue={accionCorrectivaActual ?? ""}
          rows={2}
          className="campo-input"
        />
      </label>
      <div className="flex gap-2">
        {estado === "ABIERTO" && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => enviar("EN_PROCESO")}
            className="boton-secundario text-sm"
          >
            {pendiente ? "Actualizando..." : "Marcar en proceso"}
          </button>
        )}
        <button
          type="button"
          disabled={pendiente}
          onClick={() => enviar("CERRADO")}
          className="boton-primario text-sm"
        >
          {pendiente ? "Actualizando..." : "Cerrar reclamo"}
        </button>
      </div>
    </div>
  );
}
