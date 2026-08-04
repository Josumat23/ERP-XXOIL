"use client";

import { useTransition } from "react";
import { marcarSalidaGuia, marcarEntregaGuia } from "../actions";

export default function EstadoDespachoFormulario({
  guiaId,
  estado,
}: {
  guiaId: string;
  estado: "PLANIFICADO" | "EN_RUTA" | "ENTREGADO";
}) {
  const [pendiente, iniciar] = useTransition();

  if (estado === "ENTREGADO") return null;

  return (
    <div className="flex items-center gap-2 no-imprimir">
      {estado === "PLANIFICADO" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => iniciar(async () => { await marcarSalidaGuia(guiaId); })}
          className="boton-secundario text-sm"
        >
          {pendiente ? "Registrando..." : "Marcar salida"}
        </button>
      )}
      {estado === "EN_RUTA" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => iniciar(async () => { await marcarEntregaGuia(guiaId); })}
          className="boton-primario text-sm"
        >
          {pendiente ? "Registrando..." : "Marcar entregado"}
        </button>
      )}
    </div>
  );
}
