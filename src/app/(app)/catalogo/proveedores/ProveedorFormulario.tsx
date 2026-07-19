"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valoresIniciales?: {
    razonSocial: string;
    ruc: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
  };
  textoBoton: string;
};

export default function ProveedorFormulario({ accion, valoresIniciales, textoBoton }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <Campo etiqueta="Razón social">
        <input name="razonSocial" required defaultValue={valoresIniciales?.razonSocial} className="campo-input" />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="RUC">
          <input
            name="ruc"
            defaultValue={valoresIniciales?.ruc ?? ""}
            placeholder="20123456789"
            maxLength={11}
            className="campo-input font-mono"
          />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={valoresIniciales?.telefono ?? ""} className="campo-input" />
        </Campo>
      </div>

      <Campo etiqueta="Correo electrónico">
        <input name="email" type="email" defaultValue={valoresIniciales?.email ?? ""} className="campo-input" />
      </Campo>

      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={valoresIniciales?.direccion ?? ""} className="campo-input" />
      </Campo>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : textoBoton}
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
