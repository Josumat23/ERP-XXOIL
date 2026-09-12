"use client";

import { useActionState } from "react";
import {
  agregarConductor,
  agregarVehiculo,
  crearTransportista,
  type EstadoFormulario,
} from "./actions";

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400 w-full">
      {estado.error}
    </p>
  );
}

export function NuevoTransportistaFormulario() {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearTransportista,
    {}
  );

  return (
    <form action={formAction} className="borde-seccion flex flex-col gap-3">
      <h2 className="titulo-seccion">Nuevo transportista</h2>
      <Error estado={estado} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Razón social *</span>
          <input name="razonSocial" required maxLength={200} className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">RUC</span>
          <input name="ruc" inputMode="numeric" maxLength={11} className="campo-input font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Registro MTC</span>
          <input name="registroMtc" maxLength={50} className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Teléfono</span>
          <input name="telefono" className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Contacto</span>
          <input name="contactoNombre" className="campo-input" />
        </label>
      </div>
      <div>
        <button type="submit" disabled={enviando} className="boton-primario text-sm">
          {enviando ? "Guardando…" : "Agregar transportista"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        El RUC es opcional y puede completarse después, pero sin él la guía no lo puede declarar a
        SUNAT en transporte público. El registro del MTC es referencia informativa: el sistema no
        valida su vigencia.
      </p>
    </form>
  );
}

export function VehiculoFormulario({ transportistaId }: { transportistaId: string }) {
  const accion = agregarVehiculo.bind(null, transportistaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Placa</span>
        <input name="placa" required maxLength={20} className="campo-input text-xs w-28 font-mono" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Descripción</span>
        <input name="descripcion" className="campo-input text-xs w-44" placeholder="Furgón 10 t" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Agregar vehículo"}
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function ConductorFormulario({ transportistaId }: { transportistaId: string }) {
  const accion = agregarConductor.bind(null, transportistaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Nombres</span>
        <input name="nombres" required className="campo-input text-xs w-44" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">DNI</span>
        <input name="dni" required inputMode="numeric" maxLength={8} className="campo-input text-xs w-24 font-mono" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Licencia</span>
        <input name="licencia" className="campo-input text-xs w-28" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Agregar conductor"}
      </button>
      <Error estado={estado} />
    </form>
  );
}
