"use client";

import { useActionState } from "react";
import FichaTabs from "@/components/FichaTabs";
import type { EstadoFormulario } from "./actions";

type Categoria = { id: string; nombre: string };
type UnidadMedida = { codigo: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  categorias: Categoria[];
  unidadesMedida: UnidadMedida[];
  valoresIniciales?: {
    codigo: string;
    nombre: string;
    descripcion: string | null;
    categoriaId: string;
    unidadMedidaBase: string;
    marca: string | null;
    gradoNlgi: string | null;
    viscosidad: string | null;
    vidaUtilMeses: number | null;
    segmentoMercado: string | null;
    fichaTecnicaUrl: string | null;
    hojaSeguridadUrl: string | null;
    notasTecnicas: string | null;
  };
  textoBoton: string;
};

export default function ProductoFormulario({
  accion,
  categorias,
  unidadesMedida,
  valoresIniciales,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});
  const umActual = valoresIniciales?.unidadMedidaBase;
  const umFaltante = umActual && !unidadesMedida.some((u) => u.codigo === umActual);

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-2xl">
      {estado.error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}

      <FichaTabs
        pestanas={[
          {
            id: "identificacion",
            etiqueta: "Identificación",
            contenido: (
              <div className="borde-seccion">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="Código de producto *">
                    <input
                      name="codigo"
                      required
                      defaultValue={valoresIniciales?.codigo}
                      placeholder="GR-CHASIS"
                      className="campo-input font-mono"
                    />
                  </Campo>
                  <Campo etiqueta="Categoría / línea *">
                    <select
                      name="categoriaId"
                      required
                      defaultValue={valoresIniciales?.categoriaId ?? ""}
                      className="campo-input"
                    >
                      <option value="" disabled>
                        Seleccione
                      </option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
                <Campo etiqueta="Nombre del producto *">
                  <input
                    name="nombre"
                    required
                    defaultValue={valoresIniciales?.nombre}
                    placeholder="Grasa Chasis"
                    className="campo-input"
                  />
                </Campo>
                <Campo etiqueta="Segmento de mercado">
                  <select
                    name="segmentoMercado"
                    defaultValue={valoresIniciales?.segmentoMercado ?? ""}
                    className="campo-input"
                  >
                    <option value="">Sin clasificar</option>
                    <option value="AUTOMOTRIZ">Automotriz</option>
                    <option value="INDUSTRIAL">Industrial</option>
                    <option value="MINERO">Minero</option>
                    <option value="AGRICOLA">Agrícola</option>
                    <option value="MARINO">Marino</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </Campo>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="Marca">
                    <input
                      name="marca"
                      defaultValue={valoresIniciales?.marca ?? ""}
                      placeholder="Marca propia"
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Unidad de medida base *">
                    <select
                      name="unidadMedidaBase"
                      required
                      defaultValue={umActual ?? "kg"}
                      className="campo-input"
                    >
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
              </div>
            ),
          },
          {
            id: "especificaciones",
            etiqueta: "Especificaciones técnicas",
            contenido: (
              <div className="borde-seccion">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="Grado NLGI (grasas)">
                    <select
                      name="gradoNlgi"
                      defaultValue={valoresIniciales?.gradoNlgi ?? ""}
                      className="campo-input"
                    >
                      <option value="">No aplica</option>
                      {["000", "00", "0", "1", "2", "3", "4", "5", "6"].map((g) => (
                        <option key={g} value={g}>
                          NLGI {g}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Viscosidad (aceites: ISO VG / SAE)">
                    <input
                      name="viscosidad"
                      defaultValue={valoresIniciales?.viscosidad ?? ""}
                      placeholder="SAE 15W-40, ISO VG 68..."
                      className="campo-input"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Vida útil (meses desde el envasado, vacío = no vence)">
                  <input
                    name="vidaUtilMeses"
                    type="number"
                    step="1"
                    min="1"
                    defaultValue={valoresIniciales?.vidaUtilMeses ?? ""}
                    placeholder="24"
                    className="campo-input w-32"
                  />
                </Campo>
                <Campo etiqueta="Descripción comercial">
                  <textarea
                    name="descripcion"
                    rows={2}
                    defaultValue={valoresIniciales?.descripcion ?? ""}
                    className="campo-input"
                  />
                </Campo>
                <Campo etiqueta="Notas técnicas (aplicaciones, temperatura de trabajo, etc.)">
                  <textarea
                    name="notasTecnicas"
                    rows={2}
                    defaultValue={valoresIniciales?.notasTecnicas ?? ""}
                    className="campo-input"
                  />
                </Campo>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="Ficha técnica (TDS) — enlace">
                    <input
                      name="fichaTecnicaUrl"
                      type="url"
                      defaultValue={valoresIniciales?.fichaTecnicaUrl ?? ""}
                      placeholder="https://..."
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Hoja de seguridad (FDS/MSDS) — enlace">
                    <input
                      name="hojaSeguridadUrl"
                      type="url"
                      defaultValue={valoresIniciales?.hojaSeguridadUrl ?? ""}
                      placeholder="https://..."
                      className="campo-input"
                    />
                  </Campo>
                </div>
                <p className="text-xs text-neutral-500">
                  Suba el PDF a Drive/similar y pegue aquí el enlace compartido — el sistema no
                  almacena archivos.
                </p>
              </div>
            ),
          },
        ]}
      />

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : textoBoton}
      </button>
    </form>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm mb-3 last:mb-0">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}
