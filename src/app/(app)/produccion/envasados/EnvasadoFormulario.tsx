"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearEnvasado, type EstadoFormulario } from "./actions";

type LoteOpcion = {
  id: string;
  etiqueta: string;
  productoId: string;
  kgDisponibles: number;
};

type PresentacionOpcion = {
  id: string;
  etiqueta: string;
  productoId: string;
  contenidoKg: number;
};

type InsumoOpcion = { id: string; etiqueta: string; stock: number; unidad: string };

type LineaInsumo = { insumoId: string; cantidad: string };

type Props = {
  lotes: LoteOpcion[];
  presentaciones: PresentacionOpcion[];
  insumos: InsumoOpcion[];
  loteIdInicial?: string;
};

export default function EnvasadoFormulario({ lotes, presentaciones, insumos, loteIdInicial }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearEnvasado,
    {}
  );
  const [loteId, setLoteId] = useState(loteIdInicial ?? "");
  const [presentacionId, setPresentacionId] = useState("");
  const [unidades, setUnidades] = useState("");
  const [lineas, setLineas] = useState<LineaInsumo[]>([{ insumoId: "", cantidad: "" }]);

  const lote = lotes.find((l) => l.id === loteId);
  const presentacionesDelLote = lote
    ? presentaciones.filter((p) => p.productoId === lote.productoId)
    : [];
  const presentacion = presentaciones.find((p) => p.id === presentacionId);
  const kgNecesarios =
    presentacion && Number(unidades) > 0 ? presentacion.contenidoKg * Number(unidades) : 0;

  const insumosJson = JSON.stringify(
    lineas.map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) }))
  );

  function actualizarLinea(idx: number, cambios: Partial<LineaInsumo>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Lote granel (solo aprobados con saldo)
        </span>
        <select
          name="loteGranelId"
          required
          value={loteId}
          onChange={(e) => {
            setLoteId(e.target.value);
            setPresentacionId("");
          }}
          className="campo-input"
        >
          <option value="" disabled>
            Seleccione
          </option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Presentación</span>
          <select
            name="presentacionId"
            required
            value={presentacionId}
            onChange={(e) => setPresentacionId(e.target.value)}
            disabled={!lote}
            className="campo-input"
          >
            <option value="" disabled>
              {lote ? "Seleccione" : "Elija primero el lote"}
            </option>
            {presentacionesDelLote.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Unidades</span>
          <input
            name="unidades"
            type="number"
            step="1"
            min="1"
            required
            value={unidades}
            onChange={(e) => setUnidades(e.target.value)}
            className="campo-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm w-48">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Horas de mano de obra
        </span>
        <input
          name="horasManoObra"
          type="number"
          step="0.01"
          min="0"
          defaultValue={0}
          className="campo-input"
        />
      </label>

      {lote && kgNecesarios > 0 && (
        <p
          className={`text-sm ${
            kgNecesarios > lote.kgDisponibles
              ? "text-red-600 dark:text-red-400"
              : "text-neutral-500"
          }`}
        >
          Granel necesario: {kgNecesarios.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg ·
          disponible en el lote:{" "}
          {lote.kgDisponibles.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg
        </p>
      )}

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Envases y etiquetas consumidos
        </p>
        <div className="flex flex-col gap-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                aria-label={`Insumo de la línea ${idx + 1}`}
                value={linea.insumoId}
                onChange={(e) => actualizarLinea(idx, { insumoId: e.target.value })}
                className="campo-input flex-1"
              >
                <option value="" disabled>
                  Seleccione envase o etiqueta
                </option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.etiqueta} (stock: {i.stock})
                  </option>
                ))}
              </select>
              <input
                aria-label={`Cantidad de la línea ${idx + 1}`}
                type="number"
                step="1"
                min="0"
                placeholder="Cantidad"
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                className="campo-input w-32"
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
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setLineas((prev) => [...prev, { insumoId: "", cantidad: "" }])}
            className="boton-secundario text-xs"
          >
            + Agregar línea
          </button>
          {Number(unidades) > 0 && (
            <button
              type="button"
              onClick={() =>
                setLineas((prev) => prev.map((l) => ({ ...l, cantidad: String(unidades) })))
              }
              className="boton-secundario text-xs"
            >
              Igualar cantidades a las unidades
            </button>
          )}
        </div>
      </div>

      <input type="hidden" name="insumos" value={insumosJson} />

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar envasado"}
      </button>
    </form>
  );
}
