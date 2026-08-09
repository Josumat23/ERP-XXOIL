"use client";

import { useActionState } from "react";
import { agregarDireccion, type EstadoFormulario } from "@/app/(app)/direcciones/actions";

const OPCIONES_TIPO = [
  { valor: "FACTURACION", etiqueta: "Facturación" },
  { valor: "ENVIO", etiqueta: "Envío" },
  { valor: "OTRA", etiqueta: "Otra" },
];

export default function AgregarDireccionFormulario({
  entidadTipo,
  entidadId,
  rutaRevalidar,
}: {
  entidadTipo: string;
  entidadId: string;
  rutaRevalidar: string;
}) {
  const accion = agregarDireccion.bind(null, entidadTipo, entidadId, rutaRevalidar);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-2 py-1">
          {estado.error}
        </p>
      )}
      <fieldset disabled={enviando} className="contents">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select name="tipo" defaultValue="OTRA" aria-label="Tipo de dirección" className="campo-input text-sm">
          {OPCIONES_TIPO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <input name="pais" required aria-label="País" placeholder="País" className="campo-input text-sm" />
        <input name="codigoPostal" aria-label="Código postal" placeholder="Código postal (opcional)" className="campo-input text-sm" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input name="departamento" aria-label="Departamento o estado" placeholder="Departamento / estado" className="campo-input text-sm" />
        <input name="provincia" aria-label="Provincia" placeholder="Provincia" className="campo-input text-sm" />
        <input name="distrito" aria-label="Distrito o ciudad" placeholder="Distrito / ciudad" className="campo-input text-sm" />
      </div>
      <input name="direccion" required aria-label="Dirección completa" placeholder="Dirección completa" className="campo-input text-sm" />
      <label className="flex items-center gap-2 text-xs text-neutral-500">
        <input type="checkbox" name="esPrincipal" className="h-3.5 w-3.5" />
        Marcar como dirección principal
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs self-start">
        {enviando ? "Agregando..." : "Agregar dirección"}
      </button>
      </fieldset>
      <p aria-live="polite" className="sr-only">{enviando ? "Agregando dirección" : ""}</p>
    </form>
  );
}
