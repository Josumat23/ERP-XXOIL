"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../actions";

type Accion = (prev: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export type Candidato = {
  id: string;
  etiqueta: string;
  cubiertas: number;
  total: number;
  faltantes: string[];
};

/**
 * Los candidatos se muestran como lista, no como desplegable: quien busca un
 * reemplazo quiere ver todos con su cobertura al lado y comparar, no elegir a
 * ciegas y enterarse después de qué le falta.
 */
export default function EquivalenciaFormulario({
  accion,
  candidatos,
}: {
  accion: Accion;
  candidatos: Candidato[];
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  if (candidatos.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        No quedan productos propios por declarar como equivalentes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <table className="tabla">
        <thead>
          <tr>
            <th>Nuestro producto</th>
            <th>Cubre</th>
            <th>No cubre</th>
            <th>Motivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {candidatos.map((c) => {
            const incompleto = c.cubiertas < c.total;
            return (
              <tr key={c.id}>
                <td className="font-medium">{c.etiqueta}</td>
                <td
                  className={incompleto ? "text-amber-600 dark:text-amber-400 font-medium" : ""}
                >
                  {c.cubiertas} de {c.total}
                </td>
                <td style={{ color: "var(--epicor-texto-tenue)" }}>
                  {c.faltantes.length === 0 ? "—" : c.faltantes.join(", ")}
                </td>
                <td colSpan={2}>
                  <form action={formAction} className="flex items-center gap-2">
                    <input type="hidden" name="productoId" value={c.id} />
                    {/*
                      El motivo se exige donde hay hueco y no donde no lo hay:
                      pedirlo siempre lo convierte en un campo que se rellena
                      con cualquier cosa.
                    */}
                    <input
                      name="justificacion"
                      required={incompleto}
                      placeholder={incompleto ? "Por qué se considera equivalente" : "Opcional"}
                      aria-label={`Motivo de la equivalencia con ${c.etiqueta}`}
                      className="campo-input flex-1 min-w-48"
                    />
                    <button type="submit" disabled={enviando} className="boton-secundario">
                      Declarar
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
        El sistema calcula la cobertura; la equivalencia la declara usted. Se puede declarar con
        cobertura parcial —una norma nueva reemplaza a la anterior, por ejemplo— pero entonces el
        motivo queda escrito y con su nombre.
      </p>
    </div>
  );
}
