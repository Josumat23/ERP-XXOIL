"use client";

import { useActionState } from "react";
import { ETIQUETA_TIPO_HU } from "@/lib/unidadesManipulacion";
import {
  cargarUnidad,
  crearUnidad,
  desarmarUnidad,
  moverUnidad,
  type EstadoFormulario,
} from "./actions";

type Opcion = { id: string; etiqueta: string };

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
      {estado.error}
    </p>
  );
}

export function NuevaUnidadFormulario({ zonas }: { zonas: Opcion[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(crearUnidad, {});

  if (zonas.length === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
        No hay zonas activas. Configure las zonas del almacén antes de armar unidades.
      </p>
    );
  }

  return (
    <form action={formAction} className="borde-seccion flex flex-col gap-3">
      <h2 className="titulo-seccion">Nueva unidad</h2>
      <Error estado={estado} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
          <select name="tipo" defaultValue="PALLET" className="campo-input">
            {Object.entries(ETIQUETA_TIPO_HU).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Zona</span>
          <select name="zonaAlmacenId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Código</span>
          <input name="codigo" maxLength={40} className="campo-input font-mono" placeholder="Automático" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas</span>
          <input name="notas" className="campo-input" />
        </label>
      </div>
      <div>
        <button type="submit" disabled={enviando} className="boton-primario text-sm">
          {enviando ? "Creando…" : "Crear unidad"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        El código en blanco se numera solo (HU-00001). Si el pallet ya trae una etiqueta impresa,
        escríbala: es la que alguien va a leer.
      </p>
    </form>
  );
}

export function CargarFormulario({
  unidadId,
  presentaciones,
}: {
  unidadId: string;
  presentaciones: { id: string; etiqueta: string; suelto: number }[];
}) {
  const accion = cargarUnidad.bind(null, unidadId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  if (presentaciones.length === 0) {
    return (
      <span className="text-xs text-neutral-500">
        No hay stock suelto en esta zona para subir a la unidad.
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Subir</span>
        <select name="presentacionId" required defaultValue="" className="campo-input text-xs w-64">
          <option value="" disabled>
            Seleccione
          </option>
          {presentaciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta} — {p.suelto} sueltas
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Cantidad</span>
        <input name="cantidad" type="number" step="1" min="1" required className="campo-input text-xs w-24" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Cargar"}
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function MoverFormulario({
  unidadId,
  zonas,
}: {
  unidadId: string;
  zonas: Opcion[];
}) {
  const accion = moverUnidad.bind(null, unidadId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Mover a</span>
        <select name="zonaDestinoId" required defaultValue="" className="campo-input text-xs w-52">
          <option value="" disabled>
            Seleccione
          </option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Mover"}
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function DesarmarFormulario({ unidadId }: { unidadId: string }) {
  const accion = desarmarUnidad.bind(null, unidadId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input name="notas" placeholder="Notas (opcional)" className="campo-input text-xs w-48" />
      <button
        type="submit"
        disabled={enviando}
        className="boton-secundario text-xs text-red-700 dark:text-red-400"
      >
        {enviando ? "…" : "Desarmar"}
      </button>
      <Error estado={estado} />
    </form>
  );
}
