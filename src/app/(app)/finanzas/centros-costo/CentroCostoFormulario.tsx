"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Almacen = { id: string; nombre: string };

const OPCIONES_TIPO = [
  { valor: "PRODUCCION", etiqueta: "Producción" },
  { valor: "VENTAS", etiqueta: "Ventas" },
  { valor: "ADMINISTRACION", etiqueta: "Administración" },
  { valor: "LOGISTICA", etiqueta: "Logística" },
  { valor: "OTRO", etiqueta: "Otro" },
];

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  almacenes: Almacen[];
};

export default function CentroCostoFormulario({ accion, almacenes }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Código</span>
        <input name="codigo" required placeholder="CC-PLANTA" className="campo-input font-mono" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Nombre</span>
        <input name="nombre" required placeholder="Planta de producción" className="campo-input" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
          <select name="tipo" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {OPCIONES_TIPO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Almacén / planta (opcional)
          </span>
          <select name="almacenId" defaultValue="" className="campo-input">
            <option value="">Sin asignar</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Crear centro de costo"}
      </button>
    </form>
  );
}
