"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Zona = { id: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  zonas: Zona[];
  valoresIniciales?: {
    razonSocial: string;
    ruc: string | null;
    zonaId: string | null;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
  };
  textoBoton: string;
};

export default function ClienteFormulario({ accion, zonas, valoresIniciales, textoBoton }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <Campo etiqueta="Razón social / Nombre">
        <input name="razonSocial" required defaultValue={valoresIniciales?.razonSocial} className="campo-input" />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="RUC / DNI">
          <input
            name="ruc"
            defaultValue={valoresIniciales?.ruc ?? ""}
            maxLength={11}
            className="campo-input font-mono"
          />
        </Campo>
        <Campo etiqueta="Zona">
          <select name="zonaId" defaultValue={valoresIniciales?.zonaId ?? ""} className="campo-input">
            <option value="">Sin zona asignada</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={valoresIniciales?.direccion ?? ""} className="campo-input" />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={valoresIniciales?.telefono ?? ""} className="campo-input" />
        </Campo>
        <Campo etiqueta="Correo electrónico">
          <input name="email" type="email" defaultValue={valoresIniciales?.email ?? ""} className="campo-input" />
        </Campo>
      </div>

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
