"use client";

import { useActionState } from "react";
import { guardarConfiguracionEmpresa, type EstadoFormulario } from "./actions";

type Props = {
  valores: {
    razonSocial: string;
    nombreComercial: string | null;
    ruc: string | null;
    direccion: string | null;
    ciudad: string | null;
    telefono: string | null;
    email: string | null;
    sitioWeb: string | null;
    tasaIgv: number;
  };
};

export default function EmpresaFormulario({ valores }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    guardarConfiguracionEmpresa,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-2xl">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Configuración guardada. Los documentos nuevos usarán estos datos.
        </p>
      )}

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Datos fiscales</legend>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Razón social *">
            <input name="razonSocial" required defaultValue={valores.razonSocial} className="campo-input" />
          </Campo>
          <Campo etiqueta="Nombre comercial">
            <input name="nombreComercial" defaultValue={valores.nombreComercial ?? ""} className="campo-input" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="RUC">
            <input name="ruc" maxLength={11} defaultValue={valores.ruc ?? ""} className="campo-input font-mono" />
          </Campo>
          <Campo etiqueta="Tasa de IGV (%)">
            <input
              name="tasaIgv"
              type="number"
              step="0.1"
              min="0"
              max="30"
              required
              defaultValue={valores.tasaIgv}
              className="campo-input"
            />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Contacto (aparece en los documentos impresos)</legend>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Dirección">
            <input name="direccion" defaultValue={valores.direccion ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input name="ciudad" defaultValue={valores.ciudad ?? ""} className="campo-input" />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Campo etiqueta="Teléfono">
            <input name="telefono" defaultValue={valores.telefono ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Correo electrónico">
            <input name="email" type="email" defaultValue={valores.email ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Sitio web">
            <input name="sitioWeb" defaultValue={valores.sitioWeb ?? ""} className="campo-input" />
          </Campo>
        </div>
      </fieldset>

      <p className="text-xs text-neutral-500">
        La tasa de IGV se congela en cada factura al emitirla: cambiarla aquí no altera facturas ya
        emitidas.
      </p>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Guardar configuración"}
      </button>
    </form>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm mb-3 last:mb-0">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}
