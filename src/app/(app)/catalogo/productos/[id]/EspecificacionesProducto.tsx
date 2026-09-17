"use client";

import { useActionState, useRef, useState } from "react";
import type { EstadoFormulario } from "../actions";

type Accion = (prev: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

type Opcion = { id: string; etiqueta: string };

export default function EspecificacionesProducto({
  accion,
  opciones,
  catalogoVacio,
}: {
  accion: Accion;
  opciones: Opcion[];
  /** El catálogo no tiene ninguna activa — distinto de tenerlas todas declaradas. */
  catalogoVacio: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState("CUMPLE");
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) {
        formRef.current?.reset();
        setTipo("CUMPLE");
      }
      return resultado;
    },
    {}
  );

  // Dos situaciones distintas que se ven igual si no se separan: que el
  // catálogo esté vacío, y que este producto ya declare todo lo que hay. Decir
  // lo primero cuando pasa lo segundo manda a cargar algo que ya está cargado.
  if (opciones.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        {catalogoVacio ? (
          <>
            No hay especificaciones activas en el catálogo todavía. Cárguelas en{" "}
            <a href="/catalogo/especificaciones" className="hover:underline">
              Especificaciones técnicas
            </a>
            .
          </>
        ) : (
          <>
            Este producto ya declara todas las especificaciones activas del catálogo. Para agregar
            otra, cárguela primero en{" "}
            <a href="/catalogo/especificaciones" className="hover:underline">
              Especificaciones técnicas
            </a>
            .
          </>
        )}
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Especificación</span>
          <select name="especificacionId" required className="campo-input w-56">
            <option value="">Seleccione</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Declaración</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="campo-input w-44"
          >
            <option value="CUMPLE">Cumple</option>
            <option value="HOMOLOGADO">Homologado</option>
          </select>
        </label>
        {/*
          Número y vigencia solo aparecen para una homologación, y la acción los
          exige ahí. Una aprobación sin número no se puede verificar; un
          «cumple» con número es casi seguro un tipo mal elegido, así que
          tampoco se ofrecen donde no corresponden.
        */}
        {tipo === "HOMOLOGADO" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">N.º de aprobación</span>
              <input name="numeroAprobacion" required className="campo-input w-44" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Vigente hasta</span>
              <input name="vigenteHasta" type="date" required className="campo-input w-44" />
            </label>
          </>
        )}
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : "Declarar"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        <strong>Cumple</strong> es una declaración propia del fabricante. <strong>Homologado</strong>{" "}
        es una aprobación que el organismo otorgó, con su número y su vigencia — quien lea el
        certificado puede ir a verificarla.
      </p>
    </form>
  );
}
