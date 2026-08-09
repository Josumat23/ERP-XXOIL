"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { formatMoneda } from "@/lib/format";
import { ejecutarPropuestaPago, type EstadoFormulario } from "./actions";

type Cuenta = {
  id: string;
  numeroDocumento: string;
  proveedor: string;
  fechaVencimiento: string | null;
  saldo: number;
};

export default function PropuestaPagoFormulario({ cuentas }: { cuentas: Cuenta[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(ejecutarPropuestaPago, {});
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [montos, setMontos] = useState<Record<string, string>>({});

  const seleccionadas = cuentas.filter((c) => seleccion[c.id]);
  const totalSeleccionado = useMemo(
    () => seleccionadas.reduce((acc, c) => acc + Number(montos[c.id] ?? c.saldo), 0),
    [seleccionadas, montos]
  );

  const lineasJson = JSON.stringify(
    seleccionadas.map((c) => ({ cuentaId: c.id, monto: Number(montos[c.id] ?? c.saldo) }))
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.resultado && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          {estado.resultado}
        </p>
      )}

      <table className="tabla">
        <thead>
          <tr>
            <th>Seleccionar</th>
            <th>Documento</th>
            <th>Proveedor</th>
            <th>Vencimiento</th>
            <th className="text-right">Saldo</th>
            <th className="text-right">Monto a pagar</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c, indice) => (
            <tr key={c.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Seleccionar fila ${indice + 1}: ${c.numeroDocumento} de ${c.proveedor}, saldo ${formatMoneda(c.saldo)}`}
                  checked={!!seleccion[c.id]}
                  onChange={(e) => setSeleccion((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                />
              </td>
              <td className="font-mono text-xs">{c.numeroDocumento}</td>
              <td>{c.proveedor}</td>
              <td>{c.fechaVencimiento ?? "—"}</td>
              <td className="text-right">{formatMoneda(c.saldo)}</td>
              <td className="text-right">
                <input
                  type="number"
                  aria-label={`Monto a pagar en fila ${indice + 1} para ${c.numeroDocumento}`}
                  step="0.01"
                  min="0"
                  max={c.saldo}
                  disabled={!seleccion[c.id]}
                  value={montos[c.id] ?? c.saldo}
                  onChange={(e) => setMontos((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="campo-input w-28 text-right"
                />
              </td>
            </tr>
          ))}
          {cuentas.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-neutral-500 py-6">
                No hay cuentas por pagar pendientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio de pago</span>
          <select name="medioPago" defaultValue="TRANSFERENCIA" className="campo-input w-48">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="DEPOSITO">Depósito</option>
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
          {seleccionadas.length} cuenta(s) seleccionada(s) · Total: {formatMoneda(totalSeleccionado)}
        </p>
        <button type="submit" disabled={enviando || seleccionadas.length === 0} className="boton-primario">
          {enviando ? "Procesando..." : "Ejecutar propuesta de pago"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Cada cuenta se paga con el mismo motor que un pago individual: si el monto supera el umbral
        de aprobación configurado, queda pendiente de aprobación de Gerencia en vez de descontarse
        de caja de inmediato.
      </p>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
