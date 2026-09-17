"use client";

import { useActionState, useRef, useState } from "react";
import { crearEspecificacion, type EstadoFormulario } from "./actions";

const ORGANISMOS = [
  { valor: "API", ayuda: "SN, SP, CK-4, GL-5" },
  { valor: "ACEA", ayuda: "A3/B4, C3, E9" },
  { valor: "JASO", ayuda: "MA2, MB, FC" },
  { valor: "SAE", ayuda: "15W-40, 80W-90" },
  { valor: "ISO", ayuda: "VG 68, VG 220" },
  { valor: "NLGI", ayuda: "000 a 6" },
  { valor: "OEM", ayuda: "228.31, 502.00, CES 20086" },
  { valor: "OTRO", ayuda: "" },
];

export default function EspecificacionFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const [organismo, setOrganismo] = useState("");
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, formData) => {
      const resultado = await crearEspecificacion(prev, formData);
      if (!resultado.error) {
        formRef.current?.reset();
        setOrganismo("");
      }
      return resultado;
    },
    {}
  );

  const ayuda = ORGANISMOS.find((o) => o.valor === organismo)?.ayuda ?? "";

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Agregada al catálogo.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Organismo</span>
          <select
            name="organismo"
            required
            value={organismo}
            onChange={(e) => setOrganismo(e.target.value)}
            className="campo-input w-40"
          >
            <option value="">Seleccione</option>
            {ORGANISMOS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.valor}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Código</span>
          <input name="codigo" required placeholder={ayuda || "CK-4"} className="campo-input w-40" />
        </label>
        {/*
          Solo tiene sentido para OEM, y la acción lo exige ahí: «228.31» no
          significa nada sin «Mercedes-Benz», y el certificado lo imprimiría
          igual de mudo.
        */}
        {organismo === "OEM" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Emisor</span>
            <input name="emisor" required placeholder="Mercedes-Benz" className="campo-input w-44" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-52">
          <span className="font-medium">Descripción</span>
          <input name="descripcion" placeholder="Opcional" className="campo-input w-full" />
        </label>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : "Agregar"}
        </button>
      </div>
      {ayuda && (
        <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
          Ejemplos de códigos {organismo}: {ayuda}. El catálogo lo carga usted — el sistema no
          sabe cuáles están vigentes hoy ni cuáles maneja la empresa.
        </p>
      )}
    </form>
  );
}
