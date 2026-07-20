"use client";

import { useActionState } from "react";
import FichaTabs from "@/components/FichaTabs";
import type { EstadoFormulario } from "./actions";

type Opcion = { id: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  zonas: Opcion[];
  vendedores: Opcion[];
  valoresIniciales?: {
    razonSocial: string;
    nombreComercial: string | null;
    ruc: string | null;
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    contactoNombre: string | null;
    contactoTelefono: string | null;
    zonaId: string | null;
    vendedorId: string | null;
    limiteCredito: number;
    condicionPagoDefecto: string;
    notas: string | null;
  };
  textoBoton: string;
};

export default function ClienteFormulario({
  accion,
  zonas,
  vendedores,
  valoresIniciales,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

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
                <div className="grid grid-cols-2 gap-4">
                  <Campo etiqueta="Razón social *">
                    <input
                      name="razonSocial"
                      required
                      defaultValue={valoresIniciales?.razonSocial}
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Nombre comercial">
                    <input
                      name="nombreComercial"
                      defaultValue={valoresIniciales?.nombreComercial ?? ""}
                      placeholder="Cómo se le conoce en el mercado"
                      className="campo-input"
                    />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Campo etiqueta="RUC / DNI">
                    <input
                      name="ruc"
                      defaultValue={valoresIniciales?.ruc ?? ""}
                      maxLength={11}
                      className="campo-input font-mono"
                    />
                  </Campo>
                  <Campo etiqueta="Correo electrónico">
                    <input
                      name="email"
                      type="email"
                      defaultValue={valoresIniciales?.email ?? ""}
                      className="campo-input"
                    />
                  </Campo>
                </div>
              </div>
            ),
          },
          {
            id: "ubicacion",
            etiqueta: "Ubicación",
            contenido: (
              <div className="borde-seccion">
                <div className="grid grid-cols-3 gap-4">
                  <Campo etiqueta="Departamento">
                    <input
                      name="departamento"
                      defaultValue={valoresIniciales?.departamento ?? ""}
                      placeholder="Lima"
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Provincia">
                    <input
                      name="provincia"
                      defaultValue={valoresIniciales?.provincia ?? ""}
                      placeholder="Lima"
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Distrito">
                    <input
                      name="distrito"
                      defaultValue={valoresIniciales?.distrito ?? ""}
                      placeholder="Comas"
                      className="campo-input"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Dirección">
                  <input
                    name="direccion"
                    defaultValue={valoresIniciales?.direccion ?? ""}
                    className="campo-input"
                  />
                </Campo>
              </div>
            ),
          },
          {
            id: "contacto",
            etiqueta: "Contacto",
            contenido: (
              <div className="borde-seccion">
                <div className="grid grid-cols-3 gap-4">
                  <Campo etiqueta="Teléfono de la empresa">
                    <input
                      name="telefono"
                      defaultValue={valoresIniciales?.telefono ?? ""}
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Persona de contacto">
                    <input
                      name="contactoNombre"
                      defaultValue={valoresIniciales?.contactoNombre ?? ""}
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Teléfono del contacto">
                    <input
                      name="contactoTelefono"
                      defaultValue={valoresIniciales?.contactoTelefono ?? ""}
                      className="campo-input"
                    />
                  </Campo>
                </div>
              </div>
            ),
          },
          {
            id: "condiciones",
            etiqueta: "Condiciones comerciales",
            contenido: (
              <div className="borde-seccion">
                <div className="grid grid-cols-2 gap-4">
                  <Campo etiqueta="Zona">
                    <select name="zonaId" defaultValue={valoresIniciales?.zonaId ?? ""} className="campo-input">
                      <option value="">Sin zona asignada</option>
                      {zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Vendedor asignado">
                    <select
                      name="vendedorId"
                      defaultValue={valoresIniciales?.vendedorId ?? ""}
                      className="campo-input"
                    >
                      <option value="">Sin vendedor asignado</option>
                      {vendedores.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Campo etiqueta="Límite de crédito S/ (0 = sin límite)">
                    <input
                      name="limiteCredito"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={valoresIniciales?.limiteCredito ?? 0}
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="Condición de pago habitual">
                    <select
                      name="condicionPagoDefecto"
                      defaultValue={valoresIniciales?.condicionPagoDefecto ?? "CONTADO"}
                      className="campo-input"
                    >
                      <option value="CONTADO">Contado</option>
                      <option value="DIAS_15">Crédito 15 días</option>
                      <option value="DIAS_30">Crédito 30 días</option>
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
