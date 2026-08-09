"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearReclamo, type EstadoFormulario } from "./actions";

type FacturaOpcion = { id: string; numero: string; clienteId: string };
type Opcion = { id: string; etiqueta: string };

type Props = {
  clientes: Opcion[];
  facturas: FacturaOpcion[];
  causas: Opcion[];
};

export default function ReclamoFormulario({ clientes, facturas, causas }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearReclamo,
    {}
  );
  const [clienteId, setClienteId] = useState("");
  const facturasCliente = facturas.filter((f) => f.clienteId === clienteId);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Cliente</span>
        <select
          name="clienteId"
          required
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="campo-input"
        >
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Factura relacionada (opcional)
        </span>
        <select name="facturaId" defaultValue="" className="campo-input" disabled={!clienteId}>
          <option value="">Sin factura relacionada</option>
          {facturasCliente.map((f) => (
            <option key={f.id} value={f.id}>
              {f.numero}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Causa (opcional)</span>
        <select name="causaId" defaultValue="" className="campo-input">
          <option value="">Sin determinar todavía</option>
          {causas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Descripción del reclamo
        </span>
        <textarea name="descripcion" required rows={3} className="campo-input" />
      </label>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar reclamo"}
      </button>
    </form>
  );
}
