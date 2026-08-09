"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Zona = { id: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  zonas: Zona[];
  valoresIniciales?: {
    nombre: string;
    documento: string | null;
    telefono: string | null;
    email: string | null;
    tipo: string;
    tasaComision: number;
    zonaId: string | null;
  };
  textoBoton: string;
};

export default function VendedorFormulario({ accion, zonas, valoresIniciales, textoBoton }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <Campo etiqueta="Nombre completo">
        <input name="nombre" required defaultValue={valoresIniciales?.nombre} className="campo-input" />
      </Campo>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Documento (DNI)">
          <input
            name="documento"
            defaultValue={valoresIniciales?.documento ?? ""}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={valoresIniciales?.telefono ?? ""} className="campo-input" />
        </Campo>
        <Campo etiqueta="Correo electrónico">
          <input name="email" type="email" defaultValue={valoresIniciales?.email ?? ""} className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Tipo de remuneración">
          <select name="tipo" required defaultValue={valoresIniciales?.tipo ?? ""} className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="CON_BASICO">Con sueldo básico</option>
            <option value="SOLO_COMISION">Solo comisión</option>
          </select>
        </Campo>
        <Campo etiqueta="Tasa de comisión (%)">
          <input
            name="tasaComision"
            type="number"
            step="0.1"
            min="0"
            max="100"
            required
            defaultValue={valoresIniciales?.tasaComision}
            className="campo-input"
          />
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
