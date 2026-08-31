"use client";

import { useActionState } from "react";
import {
  compensarCreditoCliente,
  rechazarReembolso,
  solicitarReembolso,
  type EstadoFormularioCredito,
} from "./actions";

type FacturaAplicable = {
  id: string;
  numero: string;
  saldo: number;
};

function Mensaje({ estado }: { estado: EstadoFormularioCredito }) {
  if (estado.error) {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.error}</p>;
  }
  if (estado.exito) {
    return <p role="status" className="text-sm text-green-700 dark:text-green-400">{estado.exito}</p>;
  }
  return null;
}

export function OperacionesCreditoFormulario({
  creditoId,
  saldo,
  moneda,
  facturas,
}: {
  creditoId: string;
  saldo: number;
  moneda: string;
  facturas: FacturaAplicable[];
}) {
  const [estadoAplicacion, aplicar, aplicando] = useActionState(
    compensarCreditoCliente.bind(null, creditoId),
    {}
  );
  const [estadoReembolso, reembolsar, reembolsando] = useActionState(
    solicitarReembolso.bind(null, creditoId),
    {}
  );

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <form action={aplicar} className="rounded-md border border-black/10 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Compensar cuenta por cobrar</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Solo facturas pendientes del mismo cliente y moneda.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Factura destino</span>
            <select name="facturaId" required defaultValue="" className="campo-input">
              <option value="" disabled>Seleccione</option>
              {facturas.map((factura) => (
                <option key={factura.id} value={factura.id}>
                  {factura.numero + " · saldo " + factura.saldo.toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Monto ({moneda})</span>
            <input name="monto" type="number" min="0.01" max={saldo} step="0.01" required className="campo-input" />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Mensaje estado={estadoAplicacion} />
          <button type="submit" disabled={aplicando || facturas.length === 0} className="boton-primario text-sm">
            {aplicando ? "Compensando..." : "Aplicar crédito"}
          </button>
        </div>
      </form>

      <form action={reembolsar} className="rounded-md border border-black/10 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Solicitar reembolso</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Los importes sobre el umbral de pagos requieren aprobación independiente.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Monto ({moneda})</span>
            <input name="monto" type="number" min="0.01" max={saldo} step="0.01" required className="campo-input" />
          </label>
          {moneda !== "PEN" && (
            <label className="flex flex-col gap-1 text-sm">
              <span>Tipo de cambio de pago</span>
              <input name="tipoCambio" type="number" min="0.0001" step="0.0001" required className="campo-input" />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>Medio de pago</span>
            <select name="medioPago" required defaultValue="" className="campo-input">
              <option value="" disabled>Seleccione</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="DEPOSITO">Depósito</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Referencia bancaria</span>
            <input name="referencia" className="campo-input" placeholder="Operación o constancia" />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Mensaje estado={estadoReembolso} />
          <button type="submit" disabled={reembolsando} className="boton-secundario text-sm">
            {reembolsando ? "Registrando..." : "Solicitar reembolso"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function RechazarReembolsoFormulario({ reembolsoId }: { reembolsoId: string }) {
  const [estado, accion, enviando] = useActionState(
    rechazarReembolso.bind(null, reembolsoId),
    {}
  );
  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
        <span>Motivo de rechazo</span>
        <input name="motivo" minLength={5} required className="campo-input" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-sm">
        {enviando ? "Rechazando..." : "Rechazar"}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}