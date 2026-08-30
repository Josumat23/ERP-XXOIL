"use client";

import { useActionState, useMemo, useState } from "react";
import SelectorSerieNumero from "@/components/SelectorSerieNumero";
import { facturarPedido, type EstadoFormulario } from "../actions";
import { calcularTotalesFacturaParcial } from "@/lib/facturacionParcial";

type Serie = { id: string; serie: string; correlativoActual: number };
type LineaFacturable = {
  id: string;
  etiqueta: string;
  sku: string;
  cantidadPedida: number;
  cantidadFacturada: number;
  saldo: number;
  precioUnitario: number;
};

export default function FacturarFormulario({
  pedidoId,
  condicionDefecto = "",
  moneda,
  tasaIgv,
  lineas,
  series = [],
}: {
  pedidoId: string;
  condicionDefecto?: string;
  moneda: string;
  tasaIgv: number;
  lineas: LineaFacturable[];
  series?: Serie[];
}) {
  const accion = facturarPedido.bind(null, pedidoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(lineas.map((linea) => [linea.id, linea.saldo]))
  );
  const totales = useMemo(
    () =>
      calcularTotalesFacturaParcial(
        lineas.map((linea) => ({
          cantidad: cantidades[linea.id] ?? 0,
          precioUnitario: linea.precioUnitario,
        })),
        tasaIgv
      ),
    [cantidades, lineas, tasaIgv]
  );
  const formato = new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda });
  const hayCantidad = Object.values(cantidades).some((cantidad) => cantidad > 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/10">
        <table className="tabla min-w-full">
          <thead>
            <tr>
              <th>Producto / presentación</th>
              <th className="text-right">Pedido</th>
              <th className="text-right">Facturado</th>
              <th className="text-right">Saldo</th>
              <th className="text-right">Facturar ahora</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => (
              <tr key={linea.id}>
                <td>
                  {linea.etiqueta}
                  <span className="block font-mono text-xs text-neutral-400">{linea.sku}</span>
                </td>
                <td className="text-right">{linea.cantidadPedida}</td>
                <td className="text-right">{linea.cantidadFacturada}</td>
                <td className="text-right font-medium">{linea.saldo}</td>
                <td className="text-right">
                  <input
                    type="number"
                    name={`cantidad:${linea.id}`}
                    min={0}
                    max={linea.saldo}
                    step={1}
                    required
                    disabled={linea.saldo === 0}
                    value={cantidades[linea.id] ?? 0}
                    onChange={(evento) => {
                      const valor = Number(evento.target.value);
                      setCantidades((actual) => ({ ...actual, [linea.id]: valor }));
                    }}
                    className="campo-input w-24 text-right"
                    aria-label={`Cantidad a facturar de ${linea.etiqueta}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex flex-wrap items-end gap-3">
          <SelectorSerieNumero series={series} etiquetaNumero="N° factura SUNAT" />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Condición de pago</span>
            <span className="campo-input w-44 bg-neutral-50 dark:bg-neutral-900">
              {condicionDefecto === "CONTADO" ? "Contado" : condicionDefecto === "DIAS_15" ? "Crédito 15 días" : "Crédito 30 días"}
            </span>
            <input type="hidden" name="condicionPago" value={condicionDefecto} />
          </div>
        </div>
        <dl className="grid min-w-64 grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          <dt className="text-neutral-500">Base parcial</dt><dd className="text-right">{formato.format(totales.subtotal)}</dd>
          <dt className="text-neutral-500">IGV ({tasaIgv}%)</dt><dd className="text-right">{formato.format(totales.igv)}</dd>
          <dt className="font-semibold">Total parcial</dt><dd className="text-right font-semibold">{formato.format(totales.total)}</dd>
        </dl>
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-500">
          El servidor vuelve a validar saldos, precios, crédito, stock y lotes antes de registrar.
        </p>
        <button type="submit" disabled={enviando || !hayCantidad} className="boton-primario whitespace-nowrap">
          {enviando ? "Facturando..." : "Registrar factura parcial"}
        </button>
      </div>
    </form>
  );
}
