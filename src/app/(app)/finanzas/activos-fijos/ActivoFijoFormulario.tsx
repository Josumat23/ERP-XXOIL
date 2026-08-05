"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Almacen = { id: string; nombre: string };
type CentroCosto = { id: string; codigo: string; nombre: string };

const OPCIONES_CATEGORIA = [
  { valor: "MAQUINARIA", etiqueta: "Maquinaria" },
  { valor: "VEHICULO", etiqueta: "Vehículo" },
  { valor: "EQUIPO_OFICINA", etiqueta: "Equipo de oficina" },
  { valor: "INMUEBLE", etiqueta: "Inmueble" },
  { valor: "OTRO", etiqueta: "Otro" },
];

type ProyectoOrigen = { id: string; etiqueta: string; nombreSugerido: string; costoSugerido: number };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  almacenes: Almacen[];
  centrosCosto: CentroCosto[];
  textoBoton: string;
  proyectoOrigen?: ProyectoOrigen | null;
};

export default function ActivoFijoFormulario({
  accion,
  almacenes,
  centrosCosto,
  textoBoton,
  proyectoOrigen,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      {proyectoOrigen && (
        <div className="text-sm bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md px-3 py-2 text-blue-800 dark:text-blue-300">
          Capitalizando el proyecto <strong>{proyectoOrigen.etiqueta}</strong>. Revise categoría y
          vida útil antes de guardar.
          <input type="hidden" name="proyectoId" value={proyectoOrigen.id} />
        </div>
      )}

      <Campo etiqueta="Nombre del activo">
        <input
          name="nombre"
          required
          defaultValue={proyectoOrigen?.nombreSugerido}
          placeholder="Mezcladora de grasas MG-500"
          className="campo-input"
        />
      </Campo>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Categoría">
          <select name="categoria" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {OPCIONES_CATEGORIA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Almacén / planta (opcional)">
          <select name="almacenId" defaultValue="" className="campo-input">
            <option value="">Sin asignar</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Centro de costo (opcional)">
        <select name="centroCostoId" defaultValue="" className="campo-input">
          <option value="">Sin asignar</option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <p className="text-xs text-neutral-500 -mt-2">
        Se usa al postear la depreciación mensual y la utilidad/pérdida si el activo se vende.
      </p>

      <Campo etiqueta="Fecha de adquisición">
        <input name="fechaAdquisicion" type="date" required className="campo-input" />
      </Campo>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Campo etiqueta="Costo de adquisición (S/)">
          <input
            name="costoAdquisicion"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={proyectoOrigen?.costoSugerido || undefined}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Valor residual (S/)">
          <input
            name="valorResidual"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Vida útil (años)">
          <input
            name="vidaUtilAnios"
            type="number"
            step="1"
            min="1"
            defaultValue={5}
            className="campo-input"
          />
        </Campo>
      </div>
      <p className="text-xs text-neutral-500 -mt-2">
        Depreciación en línea recta: (costo − valor residual) / (vida útil en años × 12), cargada
        mensualmente desde este módulo.
      </p>

      <Campo etiqueta="Notas">
        <textarea name="notas" rows={2} className="campo-input" />
      </Campo>

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
