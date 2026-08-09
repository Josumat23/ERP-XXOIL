"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { reubicarZona, type EstadoFormulario } from "./actions";

type Item = { valor: string; etiqueta: string; zonaActual: string | null };
type Zona = { id: string; almacenId: string; etiqueta: string };

type Props = {
  presentaciones: Item[];
  insumos: Item[];
  zonas: Zona[];
};

export default function ReubicarZonaFormulario({ presentaciones, insumos, zonas }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await reubicarZona(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Ítem reubicado.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Ítem a reubicar</span>
        <select name="item" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          <optgroup label="Presentaciones">
            {presentaciones.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta} {p.zonaActual ? `(hoy: ${p.zonaActual})` : "(sin zona asignada)"}
              </option>
            ))}
          </optgroup>
          <optgroup label="Insumos">
            {insumos.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.etiqueta} {i.zonaActual ? `(hoy: ${i.zonaActual})` : "(sin zona asignada)"}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Zona destino</span>
        <select name="zonaDestinoId" required defaultValue="" className="campo-input">
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

      <button type="submit" disabled={enviando} className="boton-secundario self-start">
        {enviando ? "Reubicando..." : "Reubicar"}
      </button>
    </form>
  );
}
