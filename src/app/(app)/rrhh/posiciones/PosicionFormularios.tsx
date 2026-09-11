"use client";

import { useActionState, useRef } from "react";
import {
  asignarEmpleadoAPosicion,
  cerrarAsignacionPosicion,
  crearPosicion,
  reasignarSuperiorPosicion,
  type EstadoFormulario,
} from "./actions";

export type OpcionPosicion = { id: string; etiqueta: string };
export type OpcionEmpleado = { id: string; etiqueta: string };

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error) return null;
  return (
    <span role="alert" className="text-xs text-red-600 dark:text-red-400">
      {estado.error}
    </span>
  );
}

export function PosicionFormulario({
  posiciones,
  centrosCosto,
}: {
  posiciones: OpcionPosicion[];
  centrosCosto: { id: string; etiqueta: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearPosicion(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <input
          aria-label="Código de la posición"
          name="codigo"
          required
          placeholder="Código (ej. JEF-PROD)"
          className="campo-input w-44 font-mono"
        />
        <input
          aria-label="Título de la posición"
          name="titulo"
          required
          placeholder="Título (ej. Jefe de Producción)"
          className="campo-input flex-1 min-w-52"
        />
        <input
          aria-label="Área"
          name="area"
          required
          placeholder="Área"
          className="campo-input w-40"
        />
        <select aria-label="Reporta a" name="reportaAId" defaultValue="" className="campo-input w-60">
          <option value="">Sin posición superior</option>
          {posiciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </select>
        <select
          aria-label="Centro de costo"
          name="centroCostoId"
          defaultValue=""
          className="campo-input w-52"
        >
          <option value="">Sin centro de costo</option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar posición"}
        </button>
      </div>
    </form>
  );
}

export function SuperiorFormulario({
  id,
  reportaAIdActual,
  opciones,
}: {
  id: string;
  reportaAIdActual: string | null;
  opciones: OpcionPosicion[];
}) {
  const [estado, formAction, enviando] = useActionState(
    reasignarSuperiorPosicion.bind(null, id),
    {} as EstadoFormulario
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        aria-label="Reporta a"
        name="reportaAId"
        defaultValue={reportaAIdActual ?? ""}
        className="campo-input text-sm w-52"
      >
        <option value="">Sin superior</option>
        {opciones.map((p) => (
          <option key={p.id} value={p.id}>
            {p.etiqueta}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={enviando}
        className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
      >
        Guardar
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function AsignarFormulario({
  posicionId,
  empleados,
}: {
  posicionId: string;
  empleados: OpcionEmpleado[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await asignarEmpleadoAPosicion(posicionId, prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Empleado"
        name="empleadoId"
        required
        defaultValue=""
        className="campo-input text-sm w-56"
      >
        <option value="" disabled>
          Empleado
        </option>
        {empleados.map((e) => (
          <option key={e.id} value={e.id}>
            {e.etiqueta}
          </option>
        ))}
      </select>
      <input
        aria-label="Vigente desde"
        name="vigenteDesde"
        type="date"
        required
        className="campo-input text-sm w-40"
      />
      <input
        aria-label="Vigente hasta (opcional)"
        name="vigenteHasta"
        type="date"
        className="campo-input text-sm w-40"
      />
      <input
        aria-label="Motivo"
        name="motivo"
        placeholder="Motivo (opcional)"
        className="campo-input text-sm w-48"
      />
      <button
        type="submit"
        disabled={enviando}
        className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
      >
        Asignar
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function CerrarAsignacionFormulario({ id }: { id: string }) {
  const [estado, formAction, enviando] = useActionState(
    cerrarAsignacionPosicion.bind(null, id),
    {} as EstadoFormulario
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        aria-label="Cerrar el"
        name="vigenteHasta"
        type="date"
        required
        className="campo-input text-sm w-36"
      />
      <button
        type="submit"
        disabled={enviando}
        className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
      >
        Cerrar
      </button>
      <Error estado={estado} />
    </form>
  );
}
