"use client";

import { useActionState } from "react";
import { crearEmpleado, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

const OPCIONES_CONTRATO = [
  { valor: "PLAZO_FIJO", etiqueta: "Plazo fijo" },
  { valor: "PLAZO_INDETERMINADO", etiqueta: "Plazo indeterminado" },
  { valor: "LOCACION_SERVICIOS", etiqueta: "Locación de servicios" },
];

type Props = {
  almacenes: Opcion[];
  centrosCosto: Opcion[];
};

export default function EmpleadoFormulario({ almacenes, centrosCosto }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearEmpleado,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombres">
          <input name="nombres" required className="campo-input" />
        </Campo>
        <Campo etiqueta="Apellidos">
          <input name="apellidos" required className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Campo etiqueta="DNI (opcional)">
          <input name="dni" className="campo-input font-mono" />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento (opcional)">
          <input name="fechaNacimiento" type="date" className="campo-input" />
        </Campo>
        <Campo etiqueta="Fecha de ingreso">
          <input name="fechaIngreso" type="date" required className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Cargo">
          <input name="cargo" required placeholder="Jefe de Planta" className="campo-input" />
        </Campo>
        <Campo etiqueta="Área">
          <input name="area" required placeholder="Producción" className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Tipo de contrato">
          <select name="tipoContrato" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {OPCIONES_CONTRATO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Sueldo básico (S/)">
          <input name="sueldoBasico" type="number" step="0.01" min="0" required className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Teléfono (opcional)">
          <input name="telefono" className="campo-input" />
        </Campo>
        <Campo etiqueta="Correo (opcional)">
          <input name="correo" type="email" className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Almacén / planta (opcional)">
          <select name="almacenId" defaultValue="" className="campo-input">
            <option value="">Sin asignar</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Centro de costo (opcional)">
          <select name="centroCostoId" defaultValue="" className="campo-input">
            <option value="">Sin asignar</option>
            {centrosCosto.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Notas (opcional)">
        <textarea name="notas" rows={2} className="campo-input" />
      </Campo>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Crear empleado"}
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
