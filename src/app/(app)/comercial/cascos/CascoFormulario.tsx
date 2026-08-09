"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { registrarMovimientoCasco, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

export default function CascoFormulario({
  clientes,
  insumos,
}: {
  clientes: Opcion[];
  insumos: Opcion[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await registrarMovimientoCasco(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {estado.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Cliente</span>
        <select name="clienteId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Envase retornable</span>
        <select name="insumoId" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Movimiento</span>
        <select name="tipo" required defaultValue="" className="campo-input w-36">
          <option value="" disabled>
            Seleccione
          </option>
          <option value="ENTREGADO">Entregado</option>
          <option value="DEVUELTO">Devuelto</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Cantidad</span>
        <input name="cantidad" type="number" step="1" min="1" required className="campo-input w-24" />
      </label>
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-40">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Referencia (opcional)</span>
        <input name="referencia" placeholder="Factura, guía..." className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-primario">
        {enviando ? "Registrando..." : "Registrar"}
      </button>
    </form>
  );
}
