"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearOrdenCompra, type EstadoFormulario } from "./actions";

type Opcion = { id: string; etiqueta: string };
type InsumoOpcion = { id: string; etiqueta: string; costo: number; unidad: string };
type EdtOpcion = { id: string; proyectoId: string; etiqueta: string };

type Linea = { insumoId: string; cantidad: string; costoUnitario: string; fechaEntregaEsperada: string };

type Props = {
  proveedores: Opcion[];
  insumos: InsumoOpcion[];
  almacenes: Opcion[];
  tipoCambioSugerido: number | null;
  proyectos?: Opcion[];
  edts?: EdtOpcion[];
};

export default function OrdenCompraFormulario({
  proveedores,
  insumos,
  almacenes,
  tipoCambioSugerido,
  proyectos = [],
  edts = [],
}: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearOrdenCompra,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([
    { insumoId: "", cantidad: "", costoUnitario: "", fechaEntregaEsperada: "" },
  ]);
  const [moneda, setMoneda] = useState<"PEN" | "USD">("PEN");
  const [tipoCambio, setTipoCambio] = useState(
    tipoCambioSugerido ? String(tipoCambioSugerido) : ""
  );
  const [proyectoId, setProyectoId] = useState("");
  const edtsDelProyecto = edts.filter((e) => e.proyectoId === proyectoId);

  const lineasJson = JSON.stringify(
    lineas.map((l) => ({
      insumoId: l.insumoId,
      cantidad: Number(l.cantidad),
      costoUnitario: Number(l.costoUnitario),
      fechaEntregaEsperada: l.fechaEntregaEsperada || undefined,
    }))
  );

  const total = lineas.reduce((acc, l) => {
    const c = Number(l.cantidad);
    const p = Number(l.costoUnitario);
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Proveedor</span>
          <select name="proveedorId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Almacén / planta de destino (opcional)
          </span>
          <select name="almacenId" defaultValue="" className="campo-input">
            <option value="">Sin definir (se resuelve al recepcionar)</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Moneda</span>
          <select
            name="moneda"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as "PEN" | "USD")}
            className="campo-input"
          >
            <option value="PEN">Soles (PEN)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </label>
      </div>

      {proyectos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Proyecto (opcional)
            </span>
            <select
              name="proyectoId"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="campo-input"
            >
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </label>
          {proyectoId && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Fase (opcional)
              </span>
              <select name="edtId" defaultValue="" className="campo-input">
                <option value="">Sin fase específica</option>
                {edtsDelProyecto.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {moneda === "USD" && (
        <label className="flex flex-col gap-1 text-sm max-w-xs">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Tipo de cambio (S/ por US$)
          </span>
          <input
            name="tipoCambio"
            type="number"
            step="0.001"
            min="0"
            required
            value={tipoCambio}
            onChange={(e) => setTipoCambio(e.target.value)}
            className="campo-input"
          />
          {tipoCambioSugerido && (
            <span className="text-xs text-neutral-500">
              Sugerido (BCRP): {tipoCambioSugerido.toFixed(3)}
            </span>
          )}
        </label>
      )}

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Insumos a comprar
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                aria-label={`Insumo de la línea ${idx + 1}`}
                value={linea.insumoId}
                onChange={(e) => {
                  const insumo = insumos.find((i) => i.id === e.target.value);
                  actualizarLinea(idx, {
                    insumoId: e.target.value,
                    costoUnitario: insumo ? String(insumo.costo) : linea.costoUnitario,
                  });
                }}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione insumo
                </option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.etiqueta}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Cantidad de la línea ${idx + 1}`}
                type="number"
                step="0.001"
                min="0"
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                className="campo-input w-24"
              />
              <input
                aria-label={`Costo unitario de la línea ${idx + 1}`}
                type="number"
                step="0.01"
                min="0"
                placeholder={moneda === "USD" ? "Costo US$" : "Costo S/"}
                value={linea.costoUnitario}
                onChange={(e) => actualizarLinea(idx, { costoUnitario: e.target.value })}
                className="campo-input w-28"
              />
              <input
                aria-label={`Fecha de entrega de la línea ${idx + 1}`}
                type="date"
                title="Fecha de entrega esperada"
                value={linea.fechaEntregaEsperada}
                onChange={(e) => actualizarLinea(idx, { fechaEntregaEsperada: e.target.value })}
                className="campo-input w-40"
              />
              <span className="w-28 text-right text-sm text-neutral-500">
                {(Number(linea.cantidad) * Number(linea.costoUnitario) || 0).toLocaleString(
                  "es-PE",
                  { style: "currency", currency: moneda }
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
            setLineas((prev) => [
              ...prev,
              { insumoId: "", cantidad: "", costoUnitario: "", fechaEntregaEsperada: "" },
            ])
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
        <div>
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Total: {total.toLocaleString("es-PE", { style: "currency", currency: moneda })}
          </p>
          {moneda === "USD" && Number(tipoCambio) > 0 && (
            <p className="text-xs text-neutral-500">
              ≈{" "}
              {(total * Number(tipoCambio)).toLocaleString("es-PE", {
                style: "currency",
                currency: "PEN",
              })}{" "}
              al tipo de cambio ingresado
            </p>
          )}
        </div>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Crear orden de compra"}
        </button>
      </div>

      <input type="hidden" name="lineas" value={lineasJson} />
    </form>
  );
}
