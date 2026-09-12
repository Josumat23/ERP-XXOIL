"use client";

import { useActionState, useState } from "react";
import {
  abrirCampana,
  cancelarCampana,
  certificarAcceso,
  completarCampana,
  type EstadoFormulario,
} from "./actions";

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
      {estado.error}
    </p>
  );
}

export function AbrirCampanaFormulario({ hayAbierta }: { hayAbierta: boolean }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    abrirCampana,
    {}
  );

  return (
    <form action={formAction} className="borde-seccion flex flex-col gap-3">
      <h2 className="titulo-seccion">Nueva campaña</h2>
      <Error estado={estado} />
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        Al abrirla se <strong>congela</strong> quién tiene qué acceso en este momento. Eso es lo que
        se revisa: si mañana cambia el grupo de alguien, lo certificado sigue siendo lo que se miró.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas</span>
          <input name="notas" className="campo-input w-80" placeholder="Revisión semestral" />
        </label>
        <button type="submit" disabled={enviando || hayAbierta} className="boton-primario text-sm">
          {enviando ? "Abriendo…" : "Abrir campaña"}
        </button>
      </div>
      {hayAbierta && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Ya hay una campaña abierta. Dos a la vez serían dos verdades sobre el mismo acceso.
        </p>
      )}
    </form>
  );
}

export function DecisionFormulario({
  lineaId,
  esPropio,
}: {
  lineaId: string;
  esPropio: boolean;
}) {
  const accion = certificarAcceso.bind(null, lineaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [decision, setDecision] = useState("");

  if (esPropio) {
    return (
      <span className="text-xs text-neutral-500">
        Su propio acceso: lo certifica otro administrador.
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Decisión</span>
        <select
          name="decision"
          required
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="campo-input text-xs w-32"
        >
          <option value="" disabled>
            Seleccione
          </option>
          <option value="CONFIRMADO">Confirmar</option>
          <option value="REVOCADO">Revocar</option>
        </select>
      </label>
      {decision === "REVOCADO" && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Motivo</span>
          <input name="motivo" required maxLength={500} className="campo-input text-xs w-60" />
        </label>
      )}
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Registrar"}
      </button>
      {decision === "REVOCADO" && (
        <span className="w-full text-xs text-amber-700 dark:text-amber-400">
          Revocar desactiva la cuenta. Se vuelve a otorgar desde Usuarios.
        </span>
      )}
      <Error estado={estado} />
    </form>
  );
}

export function CerrarCampanaFormularios({
  campanaId,
  pendientes,
}: {
  campanaId: string;
  pendientes: number;
}) {
  const completar = completarCampana.bind(null, campanaId);
  const cancelar = cancelarCampana.bind(null, campanaId);
  const [estadoC, accionC, enviandoC] = useActionState<EstadoFormulario, FormData>(completar, {});
  const [estadoX, accionX, enviandoX] = useActionState<EstadoFormulario, FormData>(cancelar, {});

  return (
    <div className="mt-4 flex flex-col gap-3">
      <form action={accionC} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Notas de cierre (opcional)</span>
          <input name="notas" className="campo-input text-xs w-72" />
        </label>
        <button
          type="submit"
          disabled={enviandoC || pendientes > 0}
          className="boton-primario text-xs"
        >
          {enviandoC ? "…" : "Completar campaña"}
        </button>
        {pendientes > 0 && (
          <span className="text-xs text-neutral-500">
            Quedan {pendientes} accesos sin revisar.
          </span>
        )}
        <Error estado={estadoC} />
      </form>

      <form action={accionX} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Motivo de cancelación</span>
          <input name="motivo" required maxLength={500} className="campo-input text-xs w-72" />
        </label>
        <button
          type="submit"
          disabled={enviandoX}
          className="boton-secundario text-xs text-red-700 dark:text-red-400"
        >
          {enviandoX ? "…" : "Cancelar campaña"}
        </button>
        <Error estado={estadoX} />
      </form>
    </div>
  );
}
