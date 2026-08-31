"use client";

import { useState, useTransition } from "react";
import { anularDespachoGuia, marcarEntregaGuia, marcarSalidaGuia } from "../actions";

export default function EstadoDespachoFormulario({
  guiaId,
  estado,
}: {
  guiaId: string;
  estado: "PLANIFICADO" | "EN_RUTA" | "ENTREGADO" | "ANULADO";
}) {
  const [pendiente, iniciar] = useTransition();
  const [mostrarAnulacion, setMostrarAnulacion] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();

  if (estado === "ENTREGADO" || estado === "ANULADO") return null;

  function ejecutar(accion: () => Promise<{ error?: string }>) {
    setError(undefined);
    iniciar(async () => {
      const resultado = await accion();
      if (resultado.error) setError(resultado.error);
    });
  }

  return (
    <div className="relative flex items-center gap-2 no-imprimir">
      {estado === "PLANIFICADO" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => ejecutar(() => marcarSalidaGuia(guiaId))}
          className="boton-secundario text-sm"
        >
          {pendiente ? "Registrando..." : "Marcar salida"}
        </button>
      )}
      {estado === "EN_RUTA" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => ejecutar(() => marcarEntregaGuia(guiaId))}
          className="boton-primario text-sm"
        >
          {pendiente ? "Registrando..." : "Marcar entregado"}
        </button>
      )}
      <button
        type="button"
        disabled={pendiente}
        onClick={() => setMostrarAnulacion((actual) => !actual)}
        className="boton-secundario text-sm text-red-700 dark:text-red-300"
      >
        Anular despacho
      </button>
      {mostrarAnulacion && (
        <div className="absolute right-0 top-full z-20 mt-2 w-96 rounded-lg border border-red-200 bg-white p-4 shadow-xl dark:border-red-900 dark:bg-neutral-950">
          <p className="text-sm font-semibold">Anular ejecución logística</p>
          <p className="mt-1 text-xs text-neutral-500">
            {estado === "EN_RUTA"
              ? "Se revertirán inventario, reserva, lotes y asiento PGI. No procede si existe una factura vigente."
              : "Se liberará el saldo planificado del pedido. No hubo movimiento físico."}
          </p>
          <textarea
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Motivo obligatorio (mínimo 10 caracteres)"
            className="campo mt-3 w-full"
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="boton-secundario text-sm" onClick={() => setMostrarAnulacion(false)}>
              Volver
            </button>
            <button
              type="button"
              className="boton-primario text-sm bg-red-700"
              disabled={pendiente || motivo.trim().length < 10}
              onClick={() => ejecutar(() => anularDespachoGuia(guiaId, motivo))}
            >
              {pendiente ? "Anulando..." : "Confirmar anulación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}