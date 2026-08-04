"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearEmpleado, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

const OPCIONES_CONTRATO = [
  { valor: "PLAZO_FIJO", etiqueta: "Plazo fijo" },
  { valor: "PLAZO_INDETERMINADO", etiqueta: "Plazo indeterminado" },
  { valor: "LOCACION_SERVICIOS", etiqueta: "Locación de servicios" },
];

const OPCIONES_AFP = [
  { valor: "INTEGRA", etiqueta: "Integra" },
  { valor: "PRIMA", etiqueta: "Prima" },
  { valor: "HABITAT", etiqueta: "Habitat" },
  { valor: "PROFUTURO", etiqueta: "Profuturo" },
];

const OPCIONES_DOCUMENTO_IDENTIDAD = [
  { valor: "DNI", etiqueta: "DNI" },
  { valor: "PASAPORTE", etiqueta: "Pasaporte" },
  { valor: "CARNET_EXTRANJERIA", etiqueta: "Carnet de extranjería" },
  { valor: "OTRO", etiqueta: "Otro" },
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
  const [sistemaPension, setSistemaPension] = useState("");

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
        <Campo etiqueta="Tipo de documento">
          <select name="tipoDocumentoIdentidad" defaultValue="DNI" className="campo-input">
            {OPCIONES_DOCUMENTO_IDENTIDAD.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="N° de documento (opcional)">
          <input name="dni" className="campo-input font-mono" />
        </Campo>
        <Campo etiqueta="Nacionalidad">
          <input name="nacionalidad" defaultValue="Peruana" className="campo-input" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <p className="text-xs font-medium text-neutral-500 mt-1">
        Datos de planilla (para el cálculo de sueldo — ver Recursos Humanos → Parámetros de planilla)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Sistema de pensión (opcional — sin esto, no entra en la corrida de planilla)">
          <select
            name="sistemaPension"
            value={sistemaPension}
            onChange={(e) => setSistemaPension(e.target.value)}
            className="campo-input"
          >
            <option value="">Sin definir</option>
            <option value="ONP">ONP</option>
            <option value="AFP">AFP</option>
          </select>
        </Campo>
        {sistemaPension === "AFP" && (
          <Campo etiqueta="AFP">
            <select name="afp" defaultValue="" className="campo-input">
              <option value="" disabled>
                Seleccione
              </option>
              {OPCIONES_AFP.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="asignacionFamiliar" />
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Tiene hijo(s) menor(es) de edad o que estudian (hasta 24 años) — asignación familiar
        </span>
      </label>

      <p className="text-xs font-medium text-neutral-500 mt-1">
        Datos bancarios (para el pago de haberes o transferencias a personal remoto/extranjero)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Campo etiqueta="Banco">
          <input name="banco" className="campo-input" />
        </Campo>
        <Campo etiqueta="N° de cuenta">
          <input name="numeroCuenta" className="campo-input" />
        </Campo>
        <Campo etiqueta="CCI">
          <input name="cci" className="campo-input font-mono" />
        </Campo>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="SWIFT / BIC (internacional)">
          <input name="swift" className="campo-input font-mono" />
        </Campo>
        <Campo etiqueta="IBAN (internacional)">
          <input name="iban" className="campo-input font-mono" />
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
