"use client";

import { useId, useState, useTransition } from "react";
import { actualizarPermiso } from "./actions";

export default function PermisoCheckbox({
  permisoId,
  campo,
  etiqueta,
  valorInicial,
  disabled,
}: {
  permisoId: string;
  campo: "puedeVer" | "puedeCrear" | "puedeEditar" | "puedeAprobar";
  etiqueta: string;
  valorInicial: boolean;
  disabled: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [marcado, setMarcado] = useState(valorInicial);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  return (
    <span className="inline-flex flex-col items-center">
      <input
        aria-label={etiqueta}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        type="checkbox"
        checked={marcado}
        disabled={disabled || pendiente}
        onChange={(evento) => {
          const anterior = marcado;
          const propuesto = evento.target.checked;
          setMarcado(propuesto);
          setError(null);
          startTransition(async () => {
            try {
              const resultado = await actualizarPermiso(permisoId, campo, propuesto);
              if (!resultado.ok) {
                setMarcado(anterior);
                setError(`${resultado.codigo}: ${resultado.mensaje}`);
              }
            } catch {
              setMarcado(anterior);
              setError("ERROR-SERVIDOR: No se pudo guardar el permiso. Intente nuevamente.");
            }
          });
        }}
        className="h-4 w-4"
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 max-w-48 text-left text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
