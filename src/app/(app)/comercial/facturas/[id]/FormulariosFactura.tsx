"use client";

import { useActionState } from "react";
import {
  registrarCobro,
  crearNotaCredito,
  anularFactura,
  type EstadoFormulario,
} from "../actions";

export function CobroFormulario({ facturaId, saldo }: { facturaId: string; saldo: number }) {
  const accion = registrarCobro.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Monto (saldo: S/ {saldo.toFixed(2)})
          </span>
          <input
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            max={saldo}
            required
            className="campo-input w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio de pago</span>
          <select name="medioPago" required defaultValue="" className="campo-input w-44">
            <option value="" disabled>
              Seleccione
            </option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="DEPOSITO">Depósito</option>
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Referencia (operación, voucher)
          </span>
          <input name="referencia" className="campo-input" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar cobro"}
        </button>
      </div>
    </form>
  );
}

export function NotaCreditoFormulario({
  facturaId,
  maximo,
}: {
  facturaId: string;
  maximo: number;
}) {
  const accion = crearNotaCredito.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">N° NC SUNAT</span>
          <input
            name="numero"
            required
            placeholder="FC01-00000045"
            className="campo-input font-mono w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Monto (máx.: S/ {maximo.toFixed(2)})
          </span>
          <input
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            max={maximo}
            required
            className="campo-input w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo</span>
          <input
            name="motivo"
            required
            placeholder="Devolución, descuento, error de facturación..."
            className="campo-input"
          />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar NC"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        La nota de crédito reduce el saldo por cobrar y revierte la comisión del vendedor en forma
        proporcional.
      </p>
    </form>
  );
}

export function AnularFacturaFormulario({ facturaId }: { facturaId: string }) {
  const accion = anularFactura.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Motivo de anulación (obligatorio)
          </span>
          <input name="motivo" required className="campo-input" />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {enviando ? "Anulando..." : "Anular factura"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Reingresa el stock vendido al inventario y revierte la comisión completa. Solo es posible si
        la factura no tiene cobros ni notas de crédito.
      </p>
    </form>
  );
}

function MensajeError({ texto }: { texto: string }) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
      {texto}
    </p>
  );
}
