"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registrarRecepcion, type EstadoFormulario } from "../actions";

type Pendiente = {
  detalleId: string;
  nombre: string;
  unidad: string;
  pendiente: number;
  costoUnitario: number;
};

type Props = { ordenCompraId: string; pendientes: Pendiente[] };

export default function RecepcionFormulario({ ordenCompraId, pendientes }: Props) {
  const accion = registrarRecepcion.bind(null, ordenCompraId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [costos, setCostos] = useState<Record<string, string>>({});
  const [lotes, setLotes] = useState<Record<string, string>>({});

  const lineasJson = JSON.stringify(
    pendientes.map((p) => ({
      detalleId: p.detalleId,
      cantidad: Number(cantidades[p.detalleId] ?? 0),
      costoUnitario: Number(costos[p.detalleId] ?? p.costoUnitario),
      numeroLoteProveedor: lotes[p.detalleId] ?? "",
    }))
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <table className="tabla">
        <thead>
          <tr>
            <th>Insumo</th>
            <th className="text-right">Pendiente</th>
            <th className="text-right">Cant. recibida</th>
            <th className="text-right">Costo unit. real (S/)</th>
            <th>Lote del proveedor</th>
          </tr>
        </thead>
        <tbody>
          {pendientes.map((p) => (
            <tr key={p.detalleId}>
              <td>{p.nombre}</td>
              <td className="text-right text-neutral-500">
                {p.pendiente.toLocaleString("es-PE", { maximumFractionDigits: 3 })} {p.unidad}
              </td>
              <td className="text-right">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={p.pendiente}
                  value={cantidades[p.detalleId] ?? ""}
                  onChange={(e) =>
                    setCantidades((prev) => ({ ...prev, [p.detalleId]: e.target.value }))
                  }
                  className="campo-input w-28 text-right"
                />
              </td>
              <td className="text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costos[p.detalleId] ?? p.costoUnitario}
                  onChange={(e) =>
                    setCostos((prev) => ({ ...prev, [p.detalleId]: e.target.value }))
                  }
                  className="campo-input w-28 text-right"
                />
              </td>
              <td>
                <input
                  value={lotes[p.detalleId] ?? ""}
                  onChange={(e) => setLotes((prev) => ({ ...prev, [p.detalleId]: e.target.value }))}
                  placeholder="Opcional"
                  className="campo-input w-32 font-mono text-xs"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            N° factura / guía del proveedor
          </span>
          <input name="numeroDocumento" required className="campo-input font-mono w-48" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Condición de pago</span>
          <select name="diasCredito" defaultValue="0" className="campo-input w-40">
            <option value="0">Contado</option>
            <option value="15">Crédito 15 días</option>
            <option value="30">Crédito 30 días</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas</span>
          <input name="notas" className="campo-input" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar recepción"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        La recepción genera entradas en el kardex, recalcula el costo promedio ponderado de cada
        insumo y crea la cuenta por pagar al proveedor por lo efectivamente recibido.
      </p>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
