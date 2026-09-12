"use client";

import { useState } from "react";
import type { ArbolUbigeos, UbigeoSeleccionado } from "@/lib/ubigeos";

type Props = {
  arbol: ArbolUbigeos;
  /** Ubigeo ya guardado, para preseleccionar los tres niveles. */
  seleccionado?: UbigeoSeleccionado | null;
  /**
   * Texto libre heredado, cuando la fila todavía no tiene ubigeo. No se
   * preselecciona nada con él —emparejar por nombre en el navegador repetiría
   * el problema que el catálogo viene a resolver— pero sí se muestra, para que
   * quien edite vea qué decía antes y elija el distrito correcto.
   */
  textoHeredado?: { departamento?: string | null; provincia?: string | null; distrito?: string | null };
  nombreCampo?: string;
};

export default function SelectorUbigeo({
  arbol,
  seleccionado,
  textoHeredado,
  nombreCampo = "ubigeoId",
}: Props) {
  const [departamento, setDepartamento] = useState(seleccionado?.departamento ?? "");
  const [provincia, setProvincia] = useState(seleccionado?.provincia ?? "");
  const [distritoId, setDistritoId] = useState(seleccionado?.id ?? "");

  const departamentos = Object.keys(arbol);
  const provincias = departamento ? Object.keys(arbol[departamento] ?? {}) : [];
  const distritos = departamento && provincia ? (arbol[departamento]?.[provincia] ?? []) : [];

  if (departamentos.length === 0) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        El catálogo de ubigeos está vacío. Cárguelo con <code>npm run seed:ubigeos</code> para poder
        elegir departamento, provincia y distrito.
      </p>
    );
  }

  const heredado = [textoHeredado?.departamento, textoHeredado?.provincia, textoHeredado?.distrito]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2">
      {/* El id del distrito es lo único que viaja: departamento y provincia se
          derivan de él en el servidor. */}
      <input type="hidden" name={nombreCampo} value={distritoId} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Departamento</span>
          <select
            value={departamento}
            onChange={(e) => {
              setDepartamento(e.target.value);
              setProvincia("");
              setDistritoId("");
            }}
            className="campo-input"
          >
            <option value="">—</option>
            {departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Provincia</span>
          <select
            value={provincia}
            disabled={!departamento}
            onChange={(e) => {
              setProvincia(e.target.value);
              setDistritoId("");
            }}
            className="campo-input"
          >
            <option value="">—</option>
            {provincias.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Distrito</span>
          <select
            value={distritoId}
            disabled={!provincia}
            onChange={(e) => setDistritoId(e.target.value)}
            className="campo-input"
          >
            <option value="">—</option>
            {distritos.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {heredado && !seleccionado && (
        <p className="text-xs text-neutral-500">
          Registrado antes como texto libre: <strong>{heredado}</strong>. Elija el distrito del
          catálogo para dejarlo estructurado.
        </p>
      )}
    </div>
  );
}
