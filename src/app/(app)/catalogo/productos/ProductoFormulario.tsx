"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Categoria = { id: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  categorias: Categoria[];
  valoresIniciales?: {
    codigo: string;
    nombre: string;
    descripcion: string | null;
    categoriaId: string;
  };
  textoBoton: string;
};

export default function ProductoFormulario({
  accion,
  categorias,
  valoresIniciales,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <Campo etiqueta="Código interno">
        <input
          name="codigo"
          required
          defaultValue={valoresIniciales?.codigo}
          placeholder="GR-CHASIS"
          className="campo-input"
        />
      </Campo>

      <Campo etiqueta="Nombre">
        <input
          name="nombre"
          required
          defaultValue={valoresIniciales?.nombre}
          placeholder="Grasa Chasis"
          className="campo-input"
        />
      </Campo>

      <Campo etiqueta="Categoría">
        <select
          name="categoriaId"
          required
          defaultValue={valoresIniciales?.categoriaId ?? ""}
          className="campo-input"
        >
          <option value="" disabled>
            Seleccione una categoría
          </option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Descripción (opcional)">
        <textarea
          name="descripcion"
          rows={3}
          defaultValue={valoresIniciales?.descripcion ?? ""}
          className="campo-input"
        />
      </Campo>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : textoBoton}
      </button>
    </form>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}
