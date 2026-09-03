"use client";

import { useState, useActionState } from "react";
import type { EstadoFormulario } from "./actions";

const OPCIONES_MEDIO = [
  { valor: "EFECTIVO", etiqueta: "Efectivo" },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia" },
  { valor: "DEPOSITO", etiqueta: "Depósito" },
  { valor: "YAPE", etiqueta: "Yape" },
  { valor: "PLIN", etiqueta: "Plin" },
  { valor: "OTRO", etiqueta: "Otro" },
];

type Insumo = { id: string; nombre: string; unidadMedida: string; costoUnitario: number; stock: number };
type Linea = { insumoId: string; cantidad: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  insumos: Insumo[];
  planPreventivo?: { unidadContador: string | null; contadorActual: number } | null;
  esCorrectivo?: boolean;
};

export default function CompletarFormulario({ accion, insumos, planPreventivo, esCorrectivo }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  const [repuestos, setRepuestos] = useState<Linea[]>([]);

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setRepuestos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...cambios } : r)));
  }

  const costoRepuestos = repuestos.reduce((acc, r) => {
    const insumo = insumos.find((i) => i.id === r.insumoId);
    const cantidad = Number(r.cantidad);
    return acc + (insumo && Number.isFinite(cantidad) ? cantidad * insumo.costoUnitario : 0);
  }, 0);

  const repuestosJson = JSON.stringify(
    repuestos.map((r) => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad) }))
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      {planPreventivo && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Lectura actual del contador{planPreventivo.unidadContador ? ` (${planPreventivo.unidadContador})` : ""}
          </span>
          <input
            name="contadorLectura"
            type="number"
            step="0.01"
            min={planPreventivo.contadorActual}
            defaultValue={planPreventivo.contadorActual}
            required
            className="campo-input w-40"
          />
          <span className="text-xs text-neutral-500">
            Actualiza el contador del equipo y reinicia el ciclo de este plan preventivo.
          </span>
        </label>
      )}
      {esCorrectivo && <div className="grid gap-3 border border-amber-200 rounded-lg p-3"><strong className="text-sm">Análisis de falla</strong><label className="text-sm">Modo de falla<textarea required minLength={5} name="modoFalla" className="campo-input block w-full" placeholder="Componente y manifestación de la falla"/></label><label className="text-sm">Causa técnica<select required name="causaFalla" className="campo-input block w-full"><option value="">Seleccione</option><option value="MECANICA">Mecánica</option><option value="ELECTRICA">Eléctrica</option><option value="INSTRUMENTACION">Instrumentación</option><option value="LUBRICACION">Lubricación</option><option value="OPERACION">Operación</option><option value="OTRO">Otra</option></select></label><label className="text-sm">Técnico responsable<input required name="tecnicoResponsable" className="campo-input block w-full"/></label></div>}
      <label className="text-sm"><span className="block font-medium">Tiempo real de parada (horas)</span><input name="tiempoParadaHoras" type="number" min="0" step="0.01" defaultValue={0} className="campo-input w-32"/></label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Mano de obra (S/)
        </span>
        <input
          name="costoManoObra"
          type="number"
          step="0.01"
          min="0"
          defaultValue={0}
          className="campo-input w-32"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Repuestos consumidos (opcional — descuenta stock real)
        </p>
        {repuestos.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {repuestos.map((r, idx) => {
              const insumo = insumos.find((i) => i.id === r.insumoId);
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    aria-label={`Repuesto de la línea ${idx + 1}`}
                    value={r.insumoId}
                    onChange={(e) => actualizarLinea(idx, { insumoId: e.target.value })}
                    className="campo-input flex-1"
                  >
                    <option value="" disabled>
                      Seleccione insumo
                    </option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre} (stock: {i.stock} {i.unidadMedida})
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Cantidad del repuesto de la línea ${idx + 1}`}
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="Cant."
                    value={r.cantidad}
                    onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                    className="campo-input w-24"
                  />
                  <span className="w-24 text-right text-sm text-neutral-500">
                    {insumo && Number(r.cantidad)
                      ? (Number(r.cantidad) * insumo.costoUnitario).toLocaleString("es-PE", {
                          style: "currency",
                          currency: "PEN",
                        })
                      : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRepuestos((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-neutral-400 hover:text-red-500 px-2"
                    aria-label="Quitar repuesto"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setRepuestos((prev) => [...prev, { insumoId: "", cantidad: "" }])}
          className="boton-secundario text-xs"
        >
          + Agregar repuesto
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Medio de pago (si hubo costo)
        </span>
        <select name="medioPago" defaultValue="" className="campo-input">
          <option value="" disabled>
            Seleccione
          </option>
          {OPCIONES_MEDIO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Observaciones (trabajo realizado)
        </span>
        <textarea name="observaciones" rows={2} className="campo-input" />
      </label>

      <p className="text-sm text-neutral-500">
        Costo de repuestos: {costoRepuestos.toLocaleString("es-PE", { style: "currency", currency: "PEN" })}
      </p>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Completar orden"}
      </button>

      <input type="hidden" name="repuestos" value={repuestosJson} />
    </form>
  );
}
