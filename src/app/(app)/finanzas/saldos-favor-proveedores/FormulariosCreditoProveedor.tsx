"use client";

import { useActionState } from "react";
import {
  compensarCreditoProveedor,
  registrarReembolsoRecibido,
  type EstadoFormularioCreditoProveedor,
} from "./actions";

type CuentaAplicable = { id: string; numeroDocumento: string; saldo: number };

function Mensaje({ estado }: { estado: EstadoFormularioCreditoProveedor }) {
  if (estado.error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{estado.error}</p>;
  if (estado.exito) return <p role="status" className="text-sm text-green-700 dark:text-green-400">{estado.exito}</p>;
  return null;
}

export function OperacionesCreditoProveedor({
  creditoId,
  saldo,
  cuentas,
}: {
  creditoId: string;
  saldo: number;
  cuentas: CuentaAplicable[];
}) {
  const [estadoAplicacion, aplicar, aplicando] = useActionState(
    compensarCreditoProveedor.bind(null, creditoId), {}
  );
  const [estadoReembolso, reembolsar, reembolsando] = useActionState(
    registrarReembolsoRecibido.bind(null, creditoId), {}
  );
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <form action={aplicar} className="rounded-md border border-black/10 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Compensar cuenta por pagar</h3>
        <p className="mt-1 text-xs text-neutral-500">Solo documentos pendientes del mismo proveedor y empresa.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm"><span>Documento destino</span>
            <select name="cuentaPorPagarId" required defaultValue="" className="campo-input">
              <option value="" disabled>Seleccione</option>
              {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.numeroDocumento + " · S/ " + cuenta.saldo.toFixed(2)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm"><span>Monto (PEN)</span>
            <input name="montoFuncional" type="number" min="0.01" max={saldo} step="0.01" required className="campo-input" />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3"><Mensaje estado={estadoAplicacion} />
          <button type="submit" disabled={aplicando || cuentas.length === 0} className="boton-primario text-sm">{aplicando ? "Compensando..." : "Aplicar saldo"}</button>
        </div>
      </form>
      <form action={reembolsar} className="rounded-md border border-black/10 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Registrar reembolso recibido</h3>
        <p className="mt-1 text-xs text-neutral-500">Confirme solo contra una constancia bancaria o ingreso verificable.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm"><span>Monto (PEN)</span>
            <input name="montoFuncional" type="number" min="0.01" max={saldo} step="0.01" required className="campo-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm"><span>Medio de recepción</span>
            <select name="medioPago" required defaultValue="" className="campo-input"><option value="" disabled>Seleccione</option><option value="TRANSFERENCIA">Transferencia</option><option value="DEPOSITO">Depósito</option><option value="EFECTIVO">Efectivo</option><option value="OTRO">Otro</option></select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>Referencia bancaria o constancia</span>
            <input name="referencia" minLength={3} required className="campo-input" />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3"><Mensaje estado={estadoReembolso} />
          <button type="submit" disabled={reembolsando} className="boton-secundario text-sm">{reembolsando ? "Registrando..." : "Confirmar ingreso"}</button>
        </div>
      </form>
    </div>
  );
}
