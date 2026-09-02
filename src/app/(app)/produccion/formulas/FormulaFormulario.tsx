"use client";

import { useState } from "react";
import { useActionState } from "react";
import { crearFormula, type EstadoFormulario } from "./actions";

type Producto = { id: string; codigo: string; nombre: string };
type Insumo = { id: string; codigo: string; nombre: string; unidadMedida: string };

type Linea = { insumoId: string; cantidad: string };
type Operacion = { centroTrabajoId: string; nombre: string; preparacionHoras: string; maquinaHoras: string; manoObraHoras: string };

type Props = {
  productos: Producto[];
  insumos: Insumo[];
  centrosTrabajo: { id: string; codigo: string; nombre: string }[];
};

export default function FormulaFormulario({ productos, insumos, centrosTrabajo }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearFormula,
    {}
  );
  const [lineas, setLineas] = useState<Linea[]>([{ insumoId: "", cantidad: "" }]);
  const [operaciones, setOperaciones] = useState<Operacion[]>([{ centroTrabajoId: "", nombre: "", preparacionHoras: "0", maquinaHoras: "0", manoObraHoras: "" }]);

  const detallesJson = JSON.stringify(
    lineas.map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) }))
  );
  const operacionesJson = JSON.stringify(operaciones.map((operacion) => ({ ...operacion, preparacionHoras: Number(operacion.preparacionHoras), maquinaHoras: Number(operacion.maquinaHoras), manoObraHoras: Number(operacion.manoObraHoras) })));

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Producto</span>
          <select name="productoId" required defaultValue="" className="campo-input">
            <option value="" disabled>
              Seleccione
            </option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Rendimiento del batch (kg de granel)
          </span>
          <input
            name="rendimientoKg"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="100"
            className="campo-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm max-w-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Horas-hombre estándar por batch
        </span>
        <input
          name="horasEstandar"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="8"
          className="campo-input"
        />
        <span className="text-xs text-neutral-500">
          Base versionada para medir eficiencia y variación de mano de obra.
        </span>
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Insumos del batch
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
                  Seleccione insumo
                </option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.codigo} — {i.nombre} ({i.unidadMedida})
                  </option>
                ))}
              </select>
              <input
                aria-label={`Cantidad de la línea ${idx + 1}`}
                type="number"
                step="0.001"
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
        <button
          type="button"
          onClick={() => setLineas((prev) => [...prev, { insumoId: "", cantidad: "" }])}
          className="boton-secundario mt-2 text-xs"
        >
          + Agregar insumo
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas (opcional)</span>
        <textarea name="notas" rows={2} className="campo-input" />
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Ruta de producción</p>
        <p className="text-xs text-neutral-500 mb-2">La secuencia y los tiempos quedan versionados con la fórmula.</p>
        <div className="flex flex-col gap-2">
          {operaciones.map((operacion, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.4fr_1.4fr_repeat(3,.7fr)_auto] gap-2 items-center rounded border p-2">
              <select aria-label={`Centro de trabajo de la operación ${idx + 1}`} required value={operacion.centroTrabajoId} onChange={(e) => setOperaciones((prev) => prev.map((item, i) => i === idx ? { ...item, centroTrabajoId: e.target.value } : item))} className="campo-input">
                <option value="" disabled>Centro de trabajo</option>
                {centrosTrabajo.map((centro) => <option key={centro.id} value={centro.id}>{centro.codigo} — {centro.nombre}</option>)}
              </select>
              <input aria-label={`Nombre de la operación ${idx + 1}`} required placeholder="Operación" value={operacion.nombre} onChange={(e) => setOperaciones((prev) => prev.map((item, i) => i === idx ? { ...item, nombre: e.target.value } : item))} className="campo-input" />
              {(["preparacionHoras", "maquinaHoras", "manoObraHoras"] as const).map((campo) => <input key={campo} aria-label={`${campo} de la operación ${idx + 1}`} type="number" min="0" step="0.01" required placeholder={campo === "preparacionHoras" ? "Prep." : campo === "maquinaHoras" ? "Máq." : "M.O."} value={operacion[campo]} onChange={(e) => setOperaciones((prev) => prev.map((item, i) => i === idx ? { ...item, [campo]: e.target.value } : item))} className="campo-input" />)}
              <button type="button" aria-label="Quitar operación" disabled={operaciones.length === 1} onClick={() => setOperaciones((prev) => prev.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 disabled:opacity-30">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setOperaciones((prev) => [...prev, { centroTrabajoId: "", nombre: "", preparacionHoras: "0", maquinaHoras: "0", manoObraHoras: "" }])} className="boton-secundario mt-2 text-xs">+ Agregar operación</button>
      </div>

      <input type="hidden" name="detalles" value={detallesJson} />
      <input type="hidden" name="operaciones" value={operacionesJson} />

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Crear versión de fórmula"}
      </button>
    </form>
  );
}
