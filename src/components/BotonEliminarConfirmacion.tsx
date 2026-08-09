"use client";

import { useState } from "react";

export default function BotonEliminarConfirmacion({
  descripcion,
}: {
  descripcion: string;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Eliminar ${descripcion}`}
        className="text-xs text-red-500 hover:underline whitespace-nowrap"
      >
        Eliminar
      </button>
    );
  }

  return (
    <span
      role="group"
      aria-label={`Confirmar eliminación de ${descripcion}`}
      className="flex items-center gap-2 whitespace-nowrap"
    >
      <button
        type="submit"
        className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
      >
        Sí, eliminar
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-xs text-[var(--epicor-texto-tenue)] hover:underline"
      >
        Cancelar
      </button>
    </span>
  );
}
