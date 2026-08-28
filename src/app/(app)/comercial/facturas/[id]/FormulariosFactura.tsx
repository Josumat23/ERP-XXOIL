"use client";

import { useState } from "react";
import { useActionState } from "react";
import SelectorSerieNumero from "@/components/SelectorSerieNumero";
import {
  registrarCobro,
  crearNotaCredito,
  anularFactura,
  aplicarRecargoMora,
  registrarDevolucion,
  type EstadoFormulario,
} from "../actions";
import { ETIQUETA_TIPO_NOTA_CREDITO } from "@/lib/catalogosSunat";

type Serie = { id: string; serie: string; correlativoActual: number };
type LineaDevolvible = { pedidoDetalleId: string; etiqueta: string; maxDevolvible: number };
type LineaAcreditable = {
  pedidoDetalleId: string;
  etiqueta: string;
  precioUnitario: number;
  maxAcreditable: number;
};

export function RecargoMoraFormulario({ facturaId, tasa }: { facturaId: string; tasa: number }) {
  const accion = aplicarRecargoMora.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="mt-3">
      <button type="submit" disabled={enviando} className="boton-secundario text-xs disabled:opacity-50">
        {enviando ? "Calculando…" : `Aplicar recargo por mora (${tasa}%/mes)`}
      </button>
      {estado.error && <p className="mt-2 text-sm text-red-600" role="alert">{estado.error}</p>}
    </form>
  );
}
export function CobroFormulario({

  facturaId,
  saldo,
  moneda,
  tipoCambioFactura,
}: {
  facturaId: string;
  saldo: number;
  moneda: string;
  tipoCambioFactura: number;
}) {
  const accion = registrarCobro.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Monto (saldo: {moneda} {saldo.toFixed(2)})
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
        {moneda !== "PEN" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Tipo de cambio de cobranza</span>
            <input
              name="tipoCambio"
              type="number"
              min="0.0001"
              step="0.0001"
              defaultValue={tipoCambioFactura}
              required
              className="campo-input w-40"
            />
          </label>
        )}
        {moneda === "PEN" && <input type="hidden" name="tipoCambio" value="1" />}
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
  lineas,
  series = [],
}: {
  facturaId: string;
  lineas: LineaAcreditable[];
  series?: Serie[];
}) {
  const accion = crearNotaCredito.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const disponibles = lineas.filter((l) => l.maxAcreditable > 0);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  const lineasSeleccionadas = disponibles
    .map((l) => ({ pedidoDetalleId: l.pedidoDetalleId, cantidad: Number(cantidades[l.pedidoDetalleId] ?? 0) }))
    .filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0);
  const montoEstimado = lineasSeleccionadas.reduce((acc, l) => {
    const linea = disponibles.find((d) => d.pedidoDetalleId === l.pedidoDetalleId);
    return acc + (linea ? linea.precioUnitario * l.cantidad : 0);
  }, 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}

      <table className="tabla">
        <thead>
          <tr>
            <th>Línea</th>
            <th className="text-right">Disponible</th>
            <th className="text-right">Cantidad a acreditar</th>
          </tr>
        </thead>
        <tbody>
          {disponibles.map((l) => (
            <tr key={l.pedidoDetalleId}>
              <td className="text-sm">{l.etiqueta}</td>
              <td className="text-right">{l.maxAcreditable}</td>
              <td className="text-right">
                <input
                  aria-label={`Cantidad a acreditar de ${l.etiqueta}`}
                  type="number"
                  step="1"
                  min="0"
                  max={l.maxAcreditable}
                  value={cantidades[l.pedidoDetalleId] ?? ""}
                  onChange={(e) =>
                    setCantidades((prev) => ({ ...prev, [l.pedidoDetalleId]: e.target.value }))
                  }
                  className="campo-input w-24 text-right"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-end gap-3">
        <SelectorSerieNumero series={series} etiquetaNumero="N° NC SUNAT" />
        <label className="flex flex-col gap-1 text-sm min-w-56">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Tipo de nota (Catálogo 9 SUNAT)
          </span>
          <select name="tipoNota" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {Object.entries(ETIQUETA_TIPO_NOTA_CREDITO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo</span>
          <input
            name="motivo"
            required
            placeholder="Error de digitación, producto defectuoso..."
            className="campo-input"
          />
        </label>
        <button type="submit" disabled={enviando || lineasSeleccionadas.length === 0} className="boton-primario">
          {enviando ? "Registrando..." : `Registrar NC (S/ ${montoEstimado.toFixed(2)} + IGV)`}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        El monto (con IGV) se calcula a partir de las líneas y cantidades seleccionadas — no se
        ingresa suelto. Reduce el saldo por cobrar y revierte la comisión del vendedor en forma
        proporcional.
      </p>

      <input type="hidden" name="lineas" value={JSON.stringify(lineasSeleccionadas)} />
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

export function DevolucionFormulario({
  facturaId,
  lineas,
}: {
  facturaId: string;
  lineas: LineaDevolvible[];
}) {
  const accion = registrarDevolucion.bind(null, facturaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const disponibles = lineas.filter((l) => l.maxDevolvible > 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Línea devuelta</span>
          <select name="pedidoDetalleId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {disponibles.map((l) => (
              <option key={l.pedidoDetalleId} value={l.pedidoDetalleId}>
                {l.etiqueta} (máx. {l.maxDevolvible})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Cantidad</span>
          <input name="cantidad" type="number" step="1" min="1" required className="campo-input w-28" />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-44">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo</span>
          <input
            name="motivo"
            required
            placeholder="Producto vencido, defecto, cambio..."
            className="campo-input"
          />
        </label>
        <button type="submit" disabled={enviando || disponibles.length === 0} className="boton-primario">
          {enviando ? "Registrando..." : "Registrar devolución"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Reingresa el producto al inventario (kardex). No ajusta el saldo por cobrar — si además
        corresponde devolver dinero, registre una Nota de Crédito por separado.
      </p>
    </form>
  );
}

function MensajeError({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
      {texto}
    </p>
  );
}
