"use client";

import { useRef } from "react";
import { useActionState } from "react";
import {
  guardarHorasCalendario,
  agregarDiaNoLaborable,
  quitarDiaNoLaborable,
  cargarFeriadosPeru,
  type EstadoFormulario,
} from "./actions";

type DiaNoLaborable = { id: string; fecha: string; motivo: string | null };

const DIAS: { campo: string; etiqueta: string }[] = [
  { campo: "horasLunes", etiqueta: "Lun" },
  { campo: "horasMartes", etiqueta: "Mar" },
  { campo: "horasMiercoles", etiqueta: "Mié" },
  { campo: "horasJueves", etiqueta: "Jue" },
  { campo: "horasViernes", etiqueta: "Vie" },
  { campo: "horasSabado", etiqueta: "Sáb" },
  { campo: "horasDomingo", etiqueta: "Dom" },
];

export function CalendarioProduccionFormulario({
  almacenId,
  horas,
  diasNoLaborables,
}: {
  almacenId: string;
  horas: Record<string, number>;
  diasNoLaborables: DiaNoLaborable[];
}) {
  const guardarHoras = guardarHorasCalendario.bind(null, almacenId);
  const [estadoHoras, accionHoras, enviandoHoras] = useActionState(guardarHoras, {} as EstadoFormulario);

  const formRef = useRef<HTMLFormElement>(null);
  const agregarDia = agregarDiaNoLaborable.bind(null, almacenId);
  const [estadoDia, accionDia, enviandoDia] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await agregarDia(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  const anioActual = new Date().getFullYear();
  const cargarFeriados = cargarFeriadosPeru.bind(null, almacenId, anioActual);

  return (
    <div className="mt-3 border-t border-black/10 dark:border-white/10 pt-3">
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        Calendario de producción
      </p>

      <form action={accionHoras} className="flex flex-wrap gap-3 items-end">
        {estadoHoras.error && (
          <p className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
            {estadoHoras.error}
          </p>
        )}
        {DIAS.map((d) => (
          <label key={d.campo} className="flex flex-col items-center text-xs text-neutral-500">
            {d.etiqueta}
            <input
              type="number"
              name={d.campo}
              min={0}
              max={24}
              step="0.5"
              defaultValue={horas[d.campo]}
              className="campo-input w-16 text-center"
            />
          </label>
        ))}
        <button type="submit" disabled={enviandoHoras} className="boton-secundario">
          {enviandoHoras ? "Guardando..." : "Guardar horas"}
        </button>
      </form>

      <div className="mt-4">
        <p className="text-xs font-medium text-neutral-500 mb-2">
          Días no laborables (feriados, mantenimiento, paradas de planta)
        </p>

        <div className="flex flex-wrap gap-3 items-end mb-2">
          <form ref={formRef} action={accionDia} className="contents">
            {estadoDia.error && (
              <p className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
                {estadoDia.error}
              </p>
            )}
            <input type="date" name="fecha" required className="campo-input w-40" />
            <input name="motivo" placeholder="Motivo (opcional)" className="campo-input flex-1 min-w-40" />
            <button type="submit" disabled={enviandoDia} className="boton-secundario">
              {enviandoDia ? "Agregando..." : "Agregar"}
            </button>
          </form>
          <form action={cargarFeriados}>
            <button type="submit" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
              Cargar feriados Perú {anioActual}
            </button>
          </form>
        </div>

        <ul className="flex flex-col gap-1">
          {diasNoLaborables.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between text-sm border-b border-black/5 dark:border-white/5 py-1"
            >
              <span>
                <span className="font-mono">{d.fecha}</span>
                {d.motivo && <span className="text-neutral-500"> — {d.motivo}</span>}
              </span>
              <form action={quitarDiaNoLaborable.bind(null, d.id)}>
                <button type="submit" className="text-neutral-500 hover:underline">
                  Quitar
                </button>
              </form>
            </li>
          ))}
          {diasNoLaborables.length === 0 && (
            <li className="text-sm text-neutral-500">Sin días no laborables registrados.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
