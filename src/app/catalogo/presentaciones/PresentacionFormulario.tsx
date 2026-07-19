"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Producto = { id: string; nombre: string; codigo: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  productos: Producto[];
  productoIdInicial?: string;
  valoresIniciales?: {
    productoId: string;
    sku: string;
    nombre: string;
    contenidoKg: number;
    precio: number;
    stock: number;
    stockMinimo: number;
  };
  textoBoton: string;
};

export default function PresentacionFormulario({
  accion,
  productos,
  productoIdInicial,
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

      <Campo etiqueta="Producto">
        <select
          name="productoId"
          required
          defaultValue={valoresIniciales?.productoId ?? productoIdInicial ?? ""}
          className="campo-input"
        >
          <option value="" disabled>
            Seleccione un producto
          </option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} — {p.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="SKU">
        <input
          name="sku"
          required
          defaultValue={valoresIniciales?.sku}
          placeholder="GR-CHASIS-POTE-1LB"
          className="campo-input font-mono"
        />
      </Campo>

      <Campo etiqueta="Nombre de la presentación">
        <input
          name="nombre"
          required
          defaultValue={valoresIniciales?.nombre}
          placeholder="Pote 1 lb"
          className="campo-input"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Contenido (kg)">
          <input
            name="contenidoKg"
            type="number"
            step="0.001"
            min="0"
            required
            defaultValue={valoresIniciales?.contenidoKg}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Precio (S/)">
          <input
            name="precio"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={valoresIniciales?.precio}
            className="campo-input"
          />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Stock inicial">
          <input
            name="stock"
            type="number"
            step="1"
            min="0"
            defaultValue={valoresIniciales?.stock ?? 0}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Stock mínimo">
          <input
            name="stockMinimo"
            type="number"
            step="1"
            min="0"
            defaultValue={valoresIniciales?.stockMinimo ?? 0}
            className="campo-input"
          />
        </Campo>
      </div>

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
