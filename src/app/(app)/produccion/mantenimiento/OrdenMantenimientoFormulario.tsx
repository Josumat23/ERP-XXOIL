"use client";

import { useState } from "react";
import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Equipo = { id: string; codigo: string; nombre: string; centroCostoId: string | null };
type CentroCosto = { id: string; codigo: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  equipos: Equipo[];
  centrosCosto: CentroCosto[];
  equipoIdInicial?: string;
  textoBoton: string;
};

export default function OrdenMantenimientoFormulario({
  accion,
  equipos,
  centrosCosto,
  equipoIdInicial,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  const equipoInicial = equipos.find((e) => e.id === equipoIdInicial);
  const [centroCostoId, setCentroCostoId] = useState(equipoInicial?.centroCostoId ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Equipo</span>
        <select
          name="equipoId"
          required
          defaultValue={equipoIdInicial ?? ""}
          onChange={(e) => {
            const equipo = equipos.find((eq) => eq.id === e.target.value);
            setCentroCostoId(equipo?.centroCostoId ?? "");
          }}
          className="campo-input"
        >
          <option value="" disabled>
            Seleccione
          </option>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} — {e.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo</span>
        <select name="tipo" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          <option value="PREVENTIVO">Preventivo</option>
          <option value="CORRECTIVO">Correctivo</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Descripción</span>
        <textarea
          name="descripcion"
          rows={2}
          required
          placeholder="Cambio de rodamientos y lubricación general"
          className="campo-input"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha programada</span>
          <input name="fechaProgramada" type="date" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Duración (días)</span>
          <input
            name="duracionDias"
            type="number"
            step="1"
            min="1"
            defaultValue={1}
            className="campo-input"
          />
        </label>
      </div>
      <p className="text-xs text-neutral-500 -mt-2">
        Los días de la ventana quedan bloqueados como no laborables en el calendario de producción
        del almacén del equipo (si ya está configurado).
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Centro de costo (opcional)
        </span>
        <select
          name="centroCostoId"
          value={centroCostoId}
          onChange={(e) => setCentroCostoId(e.target.value)}
          className="campo-input"
        >
          <option value="">Sin asignar (usa el del equipo, si tiene)</option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : textoBoton}
      </button>
    </form>
  );
}
