"use client";

import { useActionState, useState } from "react";
import type { EstadoFormulario } from "../actions";

type Caracteristica = {
  id: string;
  secuencia: number;
  nombre: string;
  unidadMedida: string;
  limiteInferior: string | null;
  limiteSuperior: string | null;
  metodoEnsayo: string | null;
  obligatoria: boolean;
  instrumentoId: string | null;
};

type Plan = { id: string; etiqueta: string; caracteristicas: Caracteristica[] };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  planes: Plan[];
  /** Vida útil del producto contada desde hoy: solo una sugerencia. */
  vencimientoSugerido: string | null;
  /** Instrumentos activos de la compañía. Vacío = no se cargó ninguno, y
   *  entonces el selector no aparece en vez de ofrecer una lista vacía. */
  instrumentosDisponibles: { id: string; etiqueta: string }[];
};

export default function ReanalisisFormulario({
  accion,
  planes,
  vencimientoSugerido,
  instrumentosDisponibles,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  const [planId, setPlanId] = useState("");
  const [lecturas, setLecturas] = useState<Record<string, string>>({});
  const [instrumentos, setInstrumentos] = useState<Record<string, string>>({});

  const plan = planes.find((p) => p.id === planId) ?? null;
  const limite = (v: string | null) => (v === null ? null : Number(v));

  const medidas = (plan?.caracteristicas ?? []).filter(
    (c) => lecturas[c.id] !== "" && lecturas[c.id] !== undefined
  );
  const completo =
    plan?.caracteristicas.every(
      (c) => !c.obligatoria || Number.isFinite(Number(lecturas[c.id]))
    ) ?? false;
  const fuera = medidas.some((c) => {
    const valor = Number(lecturas[c.id]);
    if (!Number.isFinite(valor)) return false;
    const minimo = limite(c.limiteInferior);
    const maximo = limite(c.limiteSuperior);
    return (minimo !== null && valor < minimo) || (maximo !== null && valor > maximo);
  });
  // Con plan, el resultado sale de las mediciones. Sin plan, lo elige quien
  // carga — y el servidor lo acepta tal cual, porque no hay contra qué
  // contrastarlo.
  const resultadoCalculado = plan ? (completo ? (fuera ? "RECHAZADO" : "APROBADO") : "") : null;

  /** Cuando se cambia de plan, las lecturas del anterior ya no significan nada. */
  const cambiarPlan = (id: string) => {
    setPlanId(id);
    setLecturas({});
    const elegido = planes.find((p) => p.id === id);
    setInstrumentos(
      Object.fromEntries((elegido?.caracteristicas ?? []).map((c) => [c.id, c.instrumentoId ?? ""]))
    );
  };

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-3xl">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Plan de inspección usado</span>
        <select
          name="planInspeccionId"
          value={planId}
          onChange={(e) => cambiarPlan(e.target.value)}
          className="campo-input"
        >
          <option value="">Sin plan declarado</option>
          {planes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Contra qué se ensayó. Se guarda con su versión: un plan cambia, y el ensayo tiene que
          poder reconstruirse tal como se hizo.
        </span>
      </label>

      {plan && (
        <>
          <input
            type="hidden"
            name="lecturas"
            value={JSON.stringify(
              medidas.map((c) => ({
                caracteristicaId: c.id,
                valorMedido: lecturas[c.id],
                instrumentoId: instrumentos[c.id] ?? "",
              }))
            )}
          />
          <div className="rounded-md border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900 p-3">
            <p className="font-medium text-sm">Mediciones del re-ensayo</p>
            <p className="text-xs text-slate-500">
              Qué dio el ensayo, no solo que se hizo. Sin esto, extender la vigencia es una
              afirmación sin evidencia.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {plan.caracteristicas.map((c) => (
                <label key={c.id} className="text-sm">
                  <span className="block font-medium">
                    {c.secuencia}. {c.nombre}
                    {c.obligatoria ? " *" : ""}
                  </span>
                  <span className="block text-xs text-neutral-500 mb-1">
                    Especificación: {c.limiteInferior ?? "−∞"} a {c.limiteSuperior ?? "+∞"}{" "}
                    {c.unidadMedida}
                    {c.metodoEnsayo ? ` · ${c.metodoEnsayo}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      required={c.obligatoria}
                      value={lecturas[c.id] ?? ""}
                      onChange={(e) => setLecturas((v) => ({ ...v, [c.id]: e.target.value }))}
                      className="campo-input w-40"
                    />
                    <span>{c.unidadMedida}</span>
                  </div>
                  {instrumentosDisponibles.length > 0 && (
                    <select
                      value={instrumentos[c.id] ?? ""}
                      onChange={(e) => setInstrumentos((v) => ({ ...v, [c.id]: e.target.value }))}
                      aria-label={`Instrumento con el que se midió ${c.nombre}`}
                      className="campo-input mt-1 w-full text-xs"
                    >
                      <option value="">Sin declarar</option>
                      {instrumentosDisponibles.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.etiqueta}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
            </div>
            <p
              className={`mt-3 text-sm font-medium ${
                resultadoCalculado === "RECHAZADO"
                  ? "text-red-600"
                  : resultadoCalculado === "APROBADO"
                    ? "text-green-700"
                    : "text-neutral-500"
              }`}
            >
              {resultadoCalculado
                ? `Resultado calculado: ${resultadoCalculado === "APROBADO" ? "Aprobado" : "Rechazado"}`
                : "Complete las mediciones para calcular el resultado."}
            </p>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Resultado del ensayo *</span>
          <select
            name="resultado"
            required
            value={plan ? (resultadoCalculado ?? "") : undefined}
            defaultValue={plan ? undefined : "APROBADO"}
            onChange={() => {}}
            disabled={Boolean(plan)}
            className="campo-input"
          >
            <option value="" disabled>
              Complete las mediciones
            </option>
            <option value="APROBADO">Aprobado — sigue en especificación</option>
            <option value="RECHAZADO">Rechazado — fuera de especificación</option>
          </select>
          {plan && <input type="hidden" name="resultado" value={resultadoCalculado ?? ""} />}
          <span className="text-xs text-slate-500">
            {plan
              ? "Con un plan declarado lo calculan las mediciones, no quien carga."
              : "Un ensayo rechazado no puede extender la vigencia; sí acortarla."}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Vencimiento nuevo *</span>
          <input
            name="vencimientoNuevo"
            type="date"
            required
            defaultValue={vencimientoSugerido ?? ""}
            className="campo-input"
          />
          {vencimientoSugerido && (
            <span className="text-xs text-slate-500">
              Sugerido: la vida útil del producto desde hoy. Puede cambiarlo.
            </span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Observaciones</span>
        <textarea name="observaciones" rows={2} className="campo-input" />
      </label>

      <button
        type="submit"
        disabled={enviando || Boolean(plan && !completo)}
        className="boton-primario self-start"
      >
        {enviando ? "Registrando…" : "Registrar re-análisis"}
      </button>
    </form>
  );
}
