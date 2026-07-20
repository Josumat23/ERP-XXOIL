"use client";

import { useState } from "react";
import { useActionState } from "react";
import SelectorSerieNumero from "@/components/SelectorSerieNumero";
import { crearGuiaRemision, type EstadoFormulario } from "./actions";

type FacturaOpcion = {
  id: string;
  etiqueta: string;
  clienteId: string;
  lineas: { presentacionId: string; cantidad: number }[];
};
type Opcion = { id: string; etiqueta: string };
type Serie = { id: string; serie: string; correlativoActual: number };

type Linea = { presentacionId: string; cantidad: string };

type Props = {
  facturas: FacturaOpcion[];
  clientes: Opcion[];
  presentaciones: Opcion[];
  puntoPartidaDefecto: string;
  series?: Serie[];
};

export default function GuiaFormulario({
  facturas,
  clientes,
  presentaciones,
  puntoPartidaDefecto,
  series = [],
}: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearGuiaRemision,
    {}
  );
  const [facturaId, setFacturaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ presentacionId: "", cantidad: "" }]);

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({ presentacionId: l.presentacionId, cantidad: Number(l.cantidad) }))
  );

  function elegirFactura(id: string) {
    setFacturaId(id);
    const factura = facturas.find((f) => f.id === id);
    if (factura) {
      setClienteId(factura.clienteId);
      setLineas(
        factura.lineas.map((l) => ({
          presentacionId: l.presentacionId,
          cantidad: String(l.cantidad),
        }))
      );
    }
  }

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Factura asociada (opcional, autocompleta el detalle)
          </span>
          <select
            name="facturaId"
            value={facturaId}
            onChange={(e) => elegirFactura(e.target.value)}
            className="campo-input"
          >
            <option value="">Sin factura asociada</option>
            {facturas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <SelectorSerieNumero series={series} etiquetaNumero="N° guía (SUNAT)" />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha de traslado</span>
          <input name="fechaTraslado" type="date" required className="campo-input" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Punto de partida</span>
          <input
            name="puntoPartida"
            required
            defaultValue={puntoPartidaDefecto}
            className="campo-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Punto de llegada</span>
          <input name="puntoLlegada" required className="campo-input" />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Transportista</span>
          <input name="transportista" className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Placa vehículo</span>
          <input name="placaVehiculo" className="campo-input font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">DNI conductor</span>
          <input name="dniConductor" maxLength={8} className="campo-input font-mono" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm max-w-md">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Motivo de traslado</span>
        <select name="motivoTraslado" defaultValue="Venta" className="campo-input">
          <option value="Venta">Venta</option>
          <option value="Traslado entre establecimientos">Traslado entre establecimientos</option>
          <option value="Devolución">Devolución</option>
          <option value="Otros">Otros</option>
        </select>
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Mercadería trasladada
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                value={linea.presentacionId}
                onChange={(e) => actualizarLinea(idx, { presentacionId: e.target.value })}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione presentación
                </option>
                {presentaciones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.etiqueta}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="1"
                min="1"
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                className="campo-input w-24"
              />
              <button
                type="button"
                onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lineas.length === 1}
                className="text-neutral-400 hover:text-red-500 disabled:opacity-30 px-2"
                aria-label="Quitar línea"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLineas((prev) => [...prev, { presentacionId: "", cantidad: "" }])}
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar línea
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Observaciones</span>
        <textarea name="observaciones" rows={2} className="campo-input" />
      </label>

      <input type="hidden" name="lineas" value={lineasJson} />

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando..." : "Crear guía de remisión"}
      </button>
    </form>
  );
}
