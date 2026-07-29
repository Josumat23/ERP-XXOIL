"use client";

import { useTransition } from "react";
import { actualizarPermiso } from "./actions";

export default function PermisoCheckbox({
  permisoId,
  campo,
  valorInicial,
  disabled,
}: {
  permisoId: string;
  campo: "puedeVer" | "puedeCrear" | "puedeEditar" | "puedeAprobar";
  valorInicial: boolean;
  disabled: boolean;
}) {
  const [pendiente, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={valorInicial}
      disabled={disabled || pendiente}
      onChange={(e) => {
        const marcado = e.target.checked;
        startTransition(async () => {
          await actualizarPermiso(permisoId, campo, marcado);
        });
      }}
      className="h-4 w-4"
    />
  );
}
