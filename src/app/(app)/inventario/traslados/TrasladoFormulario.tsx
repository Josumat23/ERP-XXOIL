"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearTraslado, type EstadoFormulario } from "./actions";

type Item = { valor: string; etiqueta: string };
type Almacen = { id: string; nombre: string };

type Props = {
  presentaciones: Item[];
  insumos: Item[];
  almacenes: Almacen[];
};

export default function TrasladoFormulario({ presentaciones, insumos, almacenes }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await crearTraslado(prev, formData);
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
          Traslado registrado.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Ítem a trasladar</span>
        <select name="item" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          <optgroup label="Presentaciones">
            {presentaciones.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </optgroup>
          <optgroup label="Insumos">
            {insumos.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.etiqueta}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Almacén origen</span>
          <select name="almacenOrigenId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Almacén destino</span>
          <select name="almacenDestinoId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Cantidad</span>
        <input name="cantidad" type="number" step="0.001" min="0" required className="campo-input" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo (opcional)</span>
        <input name="motivo" placeholder="Ej.: reposición de stock en almacén de provincia" className="campo-input" />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar traslado"}
      </button>
    </form>
  );
}
