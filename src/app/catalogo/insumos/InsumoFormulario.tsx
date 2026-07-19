"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Proveedor = { id: string; razonSocial: string };

const OPCIONES_TIPO = [
  { valor: "MATERIA_PRIMA", etiqueta: "Materia prima" },
  { valor: "ENVASE", etiqueta: "Envase" },
  { valor: "ETIQUETA", etiqueta: "Etiqueta" },
];

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  proveedores: Proveedor[];
  valoresIniciales?: {
    codigo: string;
    nombre: string;
    tipo: string;
    unidadMedida: string;
    proveedorId: string | null;
    stock: number;
    stockMinimo: number;
    costoUnitario: number;
  };
  textoBoton: string;
};

export default function InsumoFormulario({ accion, proveedores, valoresIniciales, textoBoton }: Props) {
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
          placeholder="MP-LITIO12"
          className="campo-input font-mono"
        />
      </Campo>

      <Campo etiqueta="Nombre">
        <input
          name="nombre"
          required
          defaultValue={valoresIniciales?.nombre}
          placeholder="Jabón de litio 12-hidroxiestearato"
          className="campo-input"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Tipo">
          <select
            name="tipo"
            required
            defaultValue={valoresIniciales?.tipo ?? ""}
            className="campo-input"
          >
            <option value="" disabled>
              Seleccione
            </option>
            {OPCIONES_TIPO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Unidad de medida">
          <input
            name="unidadMedida"
            required
            defaultValue={valoresIniciales?.unidadMedida}
            placeholder="kg, litro, unidad"
            className="campo-input"
          />
        </Campo>
      </div>

      <Campo etiqueta="Proveedor (opcional)">
        <select
          name="proveedorId"
          defaultValue={valoresIniciales?.proveedorId ?? ""}
          className="campo-input"
        >
          <option value="">Sin proveedor asignado</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.razonSocial}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-3 gap-4">
        <Campo etiqueta="Stock inicial">
          <input
            name="stock"
            type="number"
            step="0.001"
            min="0"
            defaultValue={valoresIniciales?.stock ?? 0}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Stock mínimo">
          <input
            name="stockMinimo"
            type="number"
            step="0.001"
            min="0"
            defaultValue={valoresIniciales?.stockMinimo ?? 0}
            className="campo-input"
          />
        </Campo>
        <Campo etiqueta="Costo unit. (S/)">
          <input
            name="costoUnitario"
            type="number"
            step="0.01"
            min="0"
            defaultValue={valoresIniciales?.costoUnitario ?? 0}
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
