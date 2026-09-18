"use client";

import { useActionState } from "react";
import { crearReclamo, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };

type Props = {
  /** Elegido antes, por GET: sus facturas ya vienen consultadas. */
  cliente: Opcion;
  facturas: { id: string; numero: string }[];
  causas: Opcion[];
};

/**
 * Alta de un reclamo, para un cliente ya elegido.
 *
 * Antes el componente recibía TODOS los clientes y las últimas 100 facturas de
 * la compañía, y filtraba las facturas por cliente en el navegador. Con volumen
 * real, un cliente sin facturas entre esas cien aparecía sin ninguna y el
 * reclamo se registraba sin relacionar — que es justo el reclamo que después no
 * puede decir de qué lote salió.
 */
export default function ReclamoFormulario({ cliente, facturas, causas }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearReclamo,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      {/*
        El cliente ya está elegido. Viaja en un campo oculto y el servidor lo
        vuelve a comprobar contra la compañía activa: que la pantalla lo haya
        resuelto no lo convierte en un dato de confianza.
      */}
      <input type="hidden" name="clienteId" value={cliente.id} />
      <p className="text-sm">
        <span className="text-neutral-500">Cliente: </span>
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {cliente.etiqueta}
        </span>
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Factura relacionada (opcional)
        </span>
        <select name="facturaId" defaultValue="" className="campo-input">
          <option value="">Sin factura relacionada</option>
          {facturas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.numero}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          {facturas.length === 0
            ? "Este cliente no tiene facturas vigentes. Sin factura, el reclamo no va a poder decir de qué lote salió."
            : "Relacionarla es lo que después permite saber de qué lote salió lo reclamado."}
        </span>
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
