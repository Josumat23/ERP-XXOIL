"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./actions";

type Proveedor = { id: string; razonSocial: string };
type ZonaAlmacen = { id: string; etiqueta: string };
type UnidadMedida = { codigo: string; nombre: string };

const OPCIONES_TIPO = [
  { valor: "MATERIA_PRIMA", etiqueta: "Materia prima" },
  { valor: "ENVASE", etiqueta: "Envase" },
  { valor: "ETIQUETA", etiqueta: "Etiqueta" },
];

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  proveedores: Proveedor[];
  zonasAlmacen: ZonaAlmacen[];
  unidadesMedida: UnidadMedida[];
  valoresIniciales?: {
    codigo: string;
    nombre: string;
    tipo: string;
    unidadMedida: string;
    proveedorId: string | null;
    stock: number;
    stockMinimo: number;
    costoUnitario: number;
    codigoProveedor: string | null;
    zonaAlmacenId: string | null;
    notas: string | null;
    requiereInspeccion: boolean;
    esRetornable: boolean;
    montoDeposito: number | null;
    esPeligroso: boolean;
    claseGhs: string | null;
  };
  textoBoton: string;
};

export default function InsumoFormulario({
  accion,
  proveedores,
  zonasAlmacen,
  unidadesMedida,
  valoresIniciales,
  textoBoton,
}: Props) {
  const umActual = valoresIniciales?.unidadMedida;
  const umFaltante = umActual && !unidadesMedida.some((u) => u.codigo === umActual);
  const [estado, formAction, enviando] = useActionState(accion, {});
  const esEdicion = Boolean(valoresIniciales);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <select
            name="unidadMedida"
            required
            defaultValue={umActual ?? ""}
            className="campo-input"
          >
            <option value="" disabled>
              Seleccione
            </option>
            {umFaltante && (
              <option value={umActual}>{umActual} (no está en el catálogo)</option>
            )}
            {unidadesMedida.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.nombre} ({u.codigo})
              </option>
            ))}
          </select>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {esEdicion ? (
          <Campo etiqueta="Stock actual">
            <input value={valoresIniciales!.stock} disabled className="campo-input opacity-60" />
          </Campo>
        ) : (
          <Campo etiqueta="Stock inicial">
            <input name="stock" type="number" step="0.001" min="0" defaultValue={0} className="campo-input" />
          </Campo>
        )}
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

      {esEdicion && (
        <p className="text-xs text-neutral-500">
          El stock no se edita aquí: use Inventario → Ajustes para regularizarlo. Todo queda auditado
          en el kardex.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Código en catálogo del proveedor">
          <input
            name="codigoProveedor"
            defaultValue={valoresIniciales?.codigoProveedor ?? ""}
            className="campo-input font-mono"
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

      <Campo etiqueta="Notas">
        <textarea
          name="notas"
          rows={2}
          defaultValue={valoresIniciales?.notas ?? ""}
          className="campo-input"
        />
      </Campo>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="requiereInspeccion"
          defaultChecked={valoresIniciales?.requiereInspeccion ?? false}
        />
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Requiere inspección de calidad al recibir
        </span>
      </label>
      <p className="text-xs text-neutral-500 -mt-3">
        Si está marcado, las recepciones de este insumo quedan pendientes de aprobación de calidad
        antes de sumar stock disponible.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="esRetornable"
          defaultChecked={valoresIniciales?.esRetornable ?? false}
        />
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Envase retornable (con depósito)
        </span>
      </label>
      <Campo etiqueta="Monto del depósito (S/, si es retornable)">
        <input
          name="montoDeposito"
          type="number"
          step="0.01"
          min="0"
          defaultValue={valoresIniciales?.montoDeposito ?? ""}
          className="campo-input w-40"
        />
      </Campo>
      <p className="text-xs text-neutral-500 -mt-3">
        Ej. tambor metálico de 55 gal: el cliente paga el depósito y lo recupera al devolver el
        casco vacío. El control de cascos pendientes por cliente se lleva manualmente por ahora.
      </p>

      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="esPeligroso"
            defaultChecked={valoresIniciales?.esPeligroso ?? false}
          />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Sustancia peligrosa (requiere hoja de seguridad SDS/MSDS)
          </span>
        </label>
        <Campo etiqueta="Clasificación de peligro GHS (opcional)">
          <input
            name="claseGhs"
            defaultValue={valoresIniciales?.claseGhs ?? ""}
            placeholder="Ej. H315, H319 - Irritante cutáneo/ocular"
            className="campo-input"
          />
        </Campo>
        {esEdicion && (
          <p className="text-xs text-neutral-500">
            La hoja de seguridad (SDS/MSDS) se adjunta como archivo abajo, después de guardar.
          </p>
        )}
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
