"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearCotizacion, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };
type ClienteOpcion = { id: string; etiqueta: string; vendedorId: string | null; canal: string | null };
type PresentacionOpcion = { id: string; etiqueta: string; precio: number };

type Linea = { presentacionId: string; cantidad: string; precioUnitario: string };

type Props = {
  clientes: ClienteOpcion[];
  vendedores: Opcion[];
  presentaciones: PresentacionOpcion[];
  descuentoPorCanal: Record<string, number>;
};

function fechaEn30Dias(): string {
  const f = new Date();
  f.setDate(f.getDate() + 30);
  return f.toISOString().slice(0, 10);
}

export default function CotizacionFormulario({
  clientes,
  vendedores,
  presentaciones,
  descuentoPorCanal,
}: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearCotizacion,
    {}
  );
  const [vendedorId, setVendedorId] = useState("");
  const [descuentoPct, setDescuentoPct] = useState(0);
  const [probabilidad, setProbabilidad] = useState(50);
  const [lineas, setLineas] = useState<Linea[]>([
    { presentacionId: "", cantidad: "", precioUnitario: "" },
  ]);

  function precioConDescuento(precioBase: number): number {
    return Math.round(precioBase * (1 - descuentoPct / 100) * 100) / 100;
  }

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({
      presentacionId: l.presentacionId,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
    }))
  );

  const total = lineas.reduce((acc, l) => {
    const c = Number(l.cantidad);
    const p = Number(l.precioUnitario);
    return acc + (Number.isFinite(c) && Number.isFinite(p) ? c * p : 0);
  }, 0);

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Cliente</span>
          <select
            name="clienteId"
            required
            defaultValue=""
            onChange={(e) => {
              const cliente = clientes.find((c) => c.id === e.target.value);
              if (cliente?.vendedorId) setVendedorId(cliente.vendedorId);
              setDescuentoPct(cliente?.canal ? descuentoPorCanal[cliente.canal] ?? 0 : 0);
            }}
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
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Vendedor</span>
          <select
            name="vendedorId"
            required
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
            className="campo-input"
          >
            <option value="" disabled>
              Seleccione
            </option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Válida hasta</span>
          <input name="validaHasta" type="date" required defaultValue={fechaEn30Dias()} className="campo-input" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm max-w-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Probabilidad de cierre: {probabilidad}%
        </span>
        <input
          name="probabilidad"
          type="range"
          min="0"
          max="100"
          step="5"
          value={probabilidad}
          onChange={(e) => setProbabilidad(Number(e.target.value))}
        />
        <span className="text-xs text-neutral-500">
          Estimado del vendedor para el embudo de ventas — se ajusta después mientras siga pendiente.
        </span>
      </label>

      {descuentoPct > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Descuento por canal aplicado a los precios sugeridos: {descuentoPct}%
        </p>
      )}

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Líneas de la cotización
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                aria-label={`Presentación de la línea ${idx + 1}`}
                value={linea.presentacionId}
                onChange={(e) => {
                  const pres = presentaciones.find((p) => p.id === e.target.value);
                  actualizarLinea(idx, {
                    presentacionId: e.target.value,
                    precioUnitario: pres ? String(precioConDescuento(pres.precio)) : linea.precioUnitario,
                  });
                }}
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
                aria-label={`Cantidad de la línea ${idx + 1}`}
                type="number"
                step="1"
                min="1"
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                className="campo-input w-24"
              />
              <input
                aria-label={`Precio unitario de la línea ${idx + 1}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio S/"
                value={linea.precioUnitario}
                onChange={(e) => actualizarLinea(idx, { precioUnitario: e.target.value })}
                className="campo-input w-28"
              />
              <span className="w-28 text-right text-sm text-neutral-500">
                {(Number(linea.cantidad) * Number(linea.precioUnitario) || 0).toLocaleString(
                  "es-PE",
                  { style: "currency", currency: "PEN" }
                )}
              </span>
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
          onClick={() =>
            setLineas((prev) => [...prev, { presentacionId: "", cantidad: "", precioUnitario: "" }])
          }
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar línea
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas (opcional)</span>
        <textarea name="notas" rows={2} className="campo-input" />
      </label>

      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4">
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Total: {total.toLocaleString("es-PE", { style: "currency", currency: "PEN" })}
        </p>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Crear cotización"}
        </button>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
