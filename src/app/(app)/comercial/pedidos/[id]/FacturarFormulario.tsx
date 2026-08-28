"use client";

import { useActionState } from "react";
import SelectorSerieNumero from "@/components/SelectorSerieNumero";
import { facturarPedido, type EstadoFormulario } from "../actions";

type Serie = { id: string; serie: string; correlativoActual: number };

export default function FacturarFormulario({
  pedidoId,
  condicionDefecto = "",
  series = [],
}: {
  pedidoId: string;
  condicionDefecto?: string;
  series?: Serie[];
}) {
  const accion = facturarPedido.bind(null, pedidoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <SelectorSerieNumero series={series} etiquetaNumero="N° factura SUNAT" />
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Condición de pago del pedido</span>
          <span className="campo-input w-44 bg-neutral-50 dark:bg-neutral-900">
            {condicionDefecto === "CONTADO" ? "Contado" : condicionDefecto === "DIAS_15" ? "Crédito 15 días" : "Crédito 30 días"}
          </span>
          <input type="hidden" name="condicionPago" value={condicionDefecto} />
        </div>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Facturando..." : "Registrar factura"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        La factura se emite en el portal SUNAT; aquí se registra su número. Al registrar se descuenta
        el stock y se genera la comisión del vendedor.
      </p>
    </form>
  );
}
