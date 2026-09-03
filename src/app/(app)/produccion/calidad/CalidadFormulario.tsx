"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registrarCalidad, type EstadoFormulario } from "./actions";

type Causa = { id: string; nombre: string };
type Plan = { id: string; version: number; nombre: string; caracteristicas: { id: string; secuencia: number; nombre: string; unidadMedida: string; limiteInferior: { toString(): string } | null; limiteSuperior: { toString(): string } | null; metodoEnsayo: string | null; obligatoria: boolean }[] };

export default function CalidadFormulario({
  loteId,
  causas,
  plan,
}: {
  loteId: string;
  causas: Causa[];
  plan: Plan | null;
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    registrarCalidad,
    {}
  );
  const [resultado, setResultado] = useState("");
  const [lecturas, setLecturas] = useState<Record<string, string>>({});
  const fuera = plan?.caracteristicas.some(c => {
    const valor = Number(lecturas[c.id]);
    if (!Number.isFinite(valor)) return false;
    const minimo = c.limiteInferior === null ? null : Number(c.limiteInferior.toString());
    const maximo = c.limiteSuperior === null ? null : Number(c.limiteSuperior.toString());
    return (minimo !== null && valor < minimo) || (maximo !== null && valor > maximo);
  }) ?? false;
  const completo = plan?.caracteristicas.every(c => !c.obligatoria || (lecturas[c.id] !== "" && lecturas[c.id] !== undefined && Number.isFinite(Number(lecturas[c.id])))) ?? false;
  const resultadoCalculado = plan ? (completo ? (fuera ? "RECHAZADO" : "APROBADO") : "") : resultado;
  const esRechazo = resultadoCalculado === "RECHAZADO";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <input type="hidden" name="loteId" value={loteId} />
      {plan && <><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="lecturas" value={JSON.stringify(plan.caracteristicas.filter(c => lecturas[c.id] !== "" && lecturas[c.id] !== undefined).map(c => ({ caracteristicaId: c.id, valorMedido: lecturas[c.id] })))} /><div className="rounded-md border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900 p-3"><p className="font-medium text-sm">{plan.nombre} · versión {plan.version}</p><div className="mt-3 grid gap-3 md:grid-cols-2">{plan.caracteristicas.map(c => <label key={c.id} className="text-sm"><span className="block font-medium">{c.secuencia}. {c.nombre}{c.obligatoria ? " *" : ""}</span><span className="block text-xs text-neutral-500 mb-1">Especificación: {c.limiteInferior?.toString() ?? "−∞"} a {c.limiteSuperior?.toString() ?? "+∞"} {c.unidadMedida}{c.metodoEnsayo ? ` · ${c.metodoEnsayo}` : ""}</span><div className="flex items-center gap-2"><input type="number" step="any" required={c.obligatoria} value={lecturas[c.id] ?? ""} onChange={e => setLecturas(v => ({ ...v, [c.id]: e.target.value }))} className="campo-input w-40" /><span>{c.unidadMedida}</span></div></label>)}</div><p className={`mt-3 text-sm font-medium ${resultadoCalculado === "RECHAZADO" ? "text-red-600" : resultadoCalculado === "APROBADO" ? "text-green-700" : "text-neutral-500"}`}>{resultadoCalculado ? `Resultado calculado: ${resultadoCalculado === "APROBADO" ? "Aprobado" : "Rechazado"}` : "Complete las mediciones para calcular el resultado."}</p></div></>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Resultado</span>
          <select
            name="resultado"
            required
            value={resultadoCalculado}
            onChange={(e) => setResultado(e.target.value)}
            className="campo-input w-40"
            disabled={Boolean(plan)}
          >
            <option value="" disabled>
              Seleccione
            </option>
            <option value="APROBADO">Aprobar</option>
            <option value="RECHAZADO">Rechazar</option>
          </select>
          {plan && <input type="hidden" name="resultado" value={resultadoCalculado} />}
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-64">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Observaciones (obligatorias si rechaza)
          </span>
          <input name="observaciones" className="campo-input" />
        </label>
      </div>
      {esRechazo && (
        <div className="flex flex-wrap items-end gap-3 border-t border-black/10 dark:border-white/10 pt-3">
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Causa (catálogo)</span>
            <select name="causaId" required={esRechazo} className="campo-input">
              <option value="">Seleccione</option>
              {causas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Detalle adicional (opcional)
            </span>
            <input
              name="causaRaiz"
              placeholder="Ej.: lote 12-A, contaminación cruzada con..."
              className="campo-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Acción correctiva
            </span>
            <input
              name="accionCorrectiva"
              placeholder="Ej.: reproceso, descarte, ajuste de fórmula..."
              className="campo-input"
            />
          </label>
        </div>
      )}
      {!plan && <p className="text-xs text-amber-700">Este producto no tiene plan vigente; se permite la evaluación heredada. Publique un plan para exigir mediciones.</p>}
      <button type="submit" disabled={enviando || Boolean(plan && !completo)} className="boton-primario self-start">
        {enviando ? "Registrando..." : "Registrar resultado"}
      </button>
    </form>
  );
}
