"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Producto = { id: string; nombre: string; codigo: string };
type ZonaAlmacen = { id: string; etiqueta: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  productos: Producto[];
  zonasAlmacen: ZonaAlmacen[];
  productoIdInicial?: string;
  valoresIniciales?: {
    productoId: string;
    sku: string;
    nombre: string;
    contenidoKg: number;
    precio: number;
    stock: number;
    stockMinimo: number;
    codigoBarras: string | null;
    pesoBrutoKg: number | null;
    unidadesPorCaja: number | null;
    zonaAlmacenId: string | null;
  };
  textoBoton: string;
};

export default function PresentacionFormulario({
  accion,
  productos,
  zonasAlmacen,
  productoIdInicial,
  valoresIniciales,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  const esEdicion = Boolean(valoresIniciales);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {esEdicion ? (
          <Campo etiqueta="Stock actual">
            <input value={valoresIniciales!.stock} disabled className="campo-input opacity-60" />
          </Campo>
        ) : (
          <Campo etiqueta="Stock inicial">
            <input name="stock" type="number" step="1" min="0" defaultValue={0} className="campo-input" />
          </Campo>
        )}
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

      {esEdicion && (
        <p className="text-xs text-neutral-500">
          El stock no se edita aquí: use Inventario → Ajustes para regularizarlo. Todo queda auditado
          en el kardex.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Código de barras (EAN-13)">
          <input
            name="codigoBarras"
            defaultValue={valoresIniciales?.codigoBarras ?? ""}
            placeholder="7750000000000"
            maxLength={14}
            className="campo-input font-mono"
          />
        </Campo>
        <Campo etiqueta="Peso bruto (kg, con envase)">
          <input
            name="pesoBrutoKg"
            type="number"
            step="0.001"
            min="0"
            defaultValue={valoresIniciales?.pesoBrutoKg ?? ""}
            className="campo-input"
          />
        </Campo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Unidades por caja">
          <input
            name="unidadesPorCaja"
            type="number"
            step="1"
            min="1"
            defaultValue={valoresIniciales?.unidadesPorCaja ?? ""}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Ubicación en almacén">
          <select
            name="zonaAlmacenId"
            defaultValue={valoresIniciales?.zonaAlmacenId ?? ""}
            className="campo-input"
          >
            <option value="">Sin ubicación asignada</option>
            {zonasAlmacen.map((z) => (
              <option key={z.id} value={z.id}>
                {z.etiqueta}
              </option>
            ))}
          </select>
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
