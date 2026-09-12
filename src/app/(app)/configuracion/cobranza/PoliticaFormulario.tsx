"use client";

import { useActionState } from "react";
import { guardarPoliticaCobranza, type EstadoPolitica } from "./actions";

type Valores = {
  diasNivel2: number;
  diasNivel3: number;
  diasSinRespuesta: number | null;
  diasGraciaCompromiso: number | null;
  pausarEnDisputa: boolean;
};

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
      <span className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        {ayuda}
      </span>
    </label>
  );
}

export default function PoliticaFormulario({ valores }: { valores: Valores }) {
  const [estado, formAction, enviando] = useActionState<EstadoPolitica, FormData>(
    guardarPoliticaCobranza,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {estado.error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2"
        >
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p
          role="status"
          className="text-sm text-green-800 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-md px-3 py-2"
        >
          {estado.aviso}
        </p>
      )}

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Nivel según antigüedad</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            etiqueta="Aviso formal a partir de (días vencidos)"
            ayuda="Por debajo de este número corresponde el aviso amistoso."
          >
            <input
              name="diasNivel2"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={valores.diasNivel2}
              className="campo-input"
            />
          </Campo>
          <Campo
            etiqueta="Aviso final a partir de (días vencidos)"
            ayuda="Tiene que ser mayor que el del aviso formal."
          >
            <input
              name="diasNivel3"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={valores.diasNivel3}
              className="campo-input"
            />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Reglas de escalamiento</legend>
        <p className="mb-4 text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
          Cada una se activa por separado. <strong>Déjela vacía</strong> para que esa regla no
          corra: definir la política no las enciende solas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            etiqueta="Escalar tras N días sin respuesta"
            ayuda="Cuenta desde la fecha del aviso, mientras siga sin respuesta o el cliente no haya contestado."
          >
            <input
              name="diasSinRespuesta"
              type="number"
              min="1"
              step="1"
              defaultValue={valores.diasSinRespuesta ?? ""}
              className="campo-input"
            />
          </Campo>
          <Campo
            etiqueta="Días de gracia tras un compromiso incumplido"
            ayuda="Cuenta desde la fecha que el cliente había comprometido."
          >
            <input
              name="diasGraciaCompromiso"
              type="number"
              min="1"
              step="1"
              defaultValue={valores.diasGraciaCompromiso ?? ""}
              className="campo-input"
            />
          </Campo>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="pausarEnDisputa"
            defaultChecked={valores.pausarEnDisputa}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              No escalar mientras la factura esté en disputa
            </span>
            <span className="block text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
              Perseguir a un cliente por una factura que todavía se le está investigando es el
              desenlace que nadie quiere. Desmárquelo si su política es escalar igual.
            </span>
          </span>
        </label>
      </fieldset>

      <div>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : "Guardar política"}
        </button>
      </div>
    </form>
  );
}
