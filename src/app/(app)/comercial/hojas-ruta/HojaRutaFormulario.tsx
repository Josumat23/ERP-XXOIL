"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearHojaRuta, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };
type Visita = { clienteId: string; objetivo: string };

type Props = { vendedores: Opcion[]; clientes: Opcion[] };

export default function HojaRutaFormulario({ vendedores, clientes }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearHojaRuta,
    {}
  );
  const [visitas, setVisitas] = useState<Visita[]>([{ clienteId: "", objetivo: "" }]);

  const visitasJson = JSON.stringify(visitas);

  function actualizarVisita(idx: number, cambios: Partial<Visita>) {
    setVisitas((prev) => prev.map((v, i) => (i === idx ? { ...v, ...cambios } : v)));
  }

  function mover(idx: number, delta: number) {
    setVisitas((prev) => {
      const destino = idx + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
      return copia;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Vendedor</span>
          <select name="vendedorId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha de la ruta</span>
          <input name="fecha" type="date" required className="campo-input" />
        </label>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Visitas planificadas (en orden)
        </p>
        <div className="flex flex-col gap-2">
          {visitas.map((visita, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-sm text-neutral-400 w-6 text-right">{idx + 1}.</span>
              <select
                aria-label={`Cliente de la visita ${idx + 1}`}
                value={visita.clienteId}
                onChange={(e) => actualizarVisita(idx, { clienteId: e.target.value })}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione cliente
                </option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Objetivo de la visita ${idx + 1}`}
                placeholder="Objetivo (cobrar, ofrecer producto...)"
                value={visita.objetivo}
                onChange={(e) => actualizarVisita(idx, { objetivo: e.target.value })}
                className="campo-input flex-1"
              />
              <button
                type="button"
                onClick={() => mover(idx, -1)}
                disabled={idx === 0}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 px-1"
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(idx, 1)}
                disabled={idx === visitas.length - 1}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 px-1"
                aria-label="Bajar"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setVisitas((prev) => prev.filter((_, i) => i !== idx))}
                disabled={visitas.length === 1}
                className="text-neutral-400 hover:text-red-500 disabled:opacity-30 px-1"
                aria-label="Quitar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setVisitas((prev) => [...prev, { clienteId: "", objetivo: "" }])}
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar visita
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas (opcional)</span>
        <textarea name="notas" rows={2} className="campo-input" />
      </label>

      <input type="hidden" name="visitas" value={visitasJson} />

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando..." : "Crear hoja de ruta"}
      </button>
    </form>
  );
}
