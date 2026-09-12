"use client";

import { useActionState, useState } from "react";
import { ESTADOS_REGISTRABLES, ETIQUETA_ESTADO_AVISO, type EstadoRegistrado } from "@/lib/gestionCobranza";
import { registrarRespuestaAviso, type EstadoFormulario } from "./actions";

export default function RespuestaAvisoFormulario({
  avisoId,
  estadoActual,
  compromisoActual,
  detalleActual,
}: {
  avisoId: string;
  estadoActual: EstadoRegistrado;
  /** yyyy-mm-dd, para el input date. */
  compromisoActual: string;
  detalleActual: string;
}) {
  const accion = registrarRespuestaAviso.bind(null, avisoId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [seleccion, setSeleccion] = useState<EstadoRegistrado>(estadoActual);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 text-xs">
      {/* Sin `value`: el select manda su propio valor y `seleccion` solo decide
          qué campos extra se muestran. Si ambos se desincronizaran, lo que se
          envía sigue siendo exactamente lo que se ve elegido en la caja. */}
      <select
        name="estado"
        defaultValue={estadoActual}
        onChange={(e) => setSeleccion(e.target.value as EstadoRegistrado)}
        className="campo-input text-xs py-1"
        aria-label="Respuesta del cliente"
      >
        {ESTADOS_REGISTRABLES.map((valor) => (
          <option key={valor} value={valor}>
            {ETIQUETA_ESTADO_AVISO[valor]}
          </option>
        ))}
      </select>

      {/* La fecha solo se pide donde significa algo. */}
      {seleccion === "COMPROMISO_PAGO" && (
        <input
          type="date"
          name="compromisoPagoEn"
          required
          defaultValue={compromisoActual}
          className="campo-input text-xs py-1"
          aria-label="Fecha comprometida"
        />
      )}

      {seleccion !== "PENDIENTE" && (
        <input
          name="detalleRespuesta"
          maxLength={500}
          defaultValue={detalleActual}
          required={seleccion === "EN_DISPUTA"}
          placeholder={seleccion === "EN_DISPUTA" ? "Qué objeta el cliente" : "Detalle (opcional)"}
          className="campo-input text-xs py-1 w-52"
          aria-label="Detalle de la respuesta"
        />
      )}

      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "Guardando..." : "Registrar respuesta"}
      </button>
      {estado.error && (
        <p role="alert" className="w-full text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}
    </form>
  );
}
