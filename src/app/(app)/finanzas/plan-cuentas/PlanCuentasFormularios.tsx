"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearCuentaContable, asignarControlContable, type EstadoFormulario } from "./actions";

export function CuentaFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearCuentaContable(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <input name="codigo" aria-label="Código de cuenta" required placeholder="Código (ej. 1212)" className="campo-input w-36 font-mono" />
        <input name="nombre" aria-label="Nombre de la cuenta" required placeholder="Nombre de la cuenta" className="campo-input flex-1 min-w-56" />
        <select name="tipo" aria-label="Tipo de cuenta" required defaultValue="" className="campo-input w-40">
          <option value="" disabled>
            Tipo
          </option>
          <option value="ACTIVO">Activo</option>
          <option value="PASIVO">Pasivo</option>
          <option value="PATRIMONIO">Patrimonio</option>
          <option value="INGRESO">Ingreso</option>
          <option value="GASTO">Gasto</option>
        </select>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar cuenta"}
        </button>
      </div>
    </form>
  );
}

export function ControlFormulario({
  clave,
  etiqueta,
  cuentaActualId,
  cuentas,
}: {
  clave: string;
  etiqueta: string;
  cuentaActualId: string | null;
  cuentas: { id: string; etiqueta: string }[];
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    asignarControlContable,
    {}
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <span className="text-sm w-72 shrink-0">{etiqueta}</span>
      <input type="hidden" name="clave" value={clave} />
      <select
        name="cuentaId"
        aria-label={etiqueta}
        defaultValue={cuentaActualId ?? ""}
        className="campo-input flex-1"
      >
        <option value="" disabled>
          Sin cuenta asignada
        </option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.etiqueta}
          </option>
        ))}
      </select>
      <button type="submit" aria-label={`Guardar ${etiqueta}`} disabled={enviando} className="boton-secundario text-xs whitespace-nowrap">
        {enviando ? "..." : "Guardar"}
      </button>
      {estado.error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{estado.error}</span>}
    </form>
  );
}
