"use client";

import { useActionState, useState } from "react";
import FichaTabs from "@/components/FichaTabs";
import SelectorUbigeo from "@/components/SelectorUbigeo";
import type { ArbolUbigeos, UbigeoSeleccionado } from "@/lib/ubigeos";
import { ETIQUETA_CANAL_CLIENTE } from "@/lib/etiquetas";
import { creacionRequiereAprobacion, decidirCambioLimiteCredito } from "@/lib/aprobacionCredito";
import type { EstadoFormulario } from "./actions";

const CANALES = Object.keys(ETIQUETA_CANAL_CLIENTE) as (keyof typeof ETIQUETA_CANAL_CLIENTE)[];

const OPCIONES_DOCUMENTO_FISCAL = [
  { valor: "RUC", etiqueta: "RUC / DNI (Perú)" },
  { valor: "RUT", etiqueta: "RUT (Chile)" },
  { valor: "NIT", etiqueta: "NIT (Colombia)" },
  { valor: "RFC", etiqueta: "RFC (México)" },
  { valor: "EIN", etiqueta: "EIN (Estados Unidos)" },
  { valor: "VAT", etiqueta: "VAT (Unión Europea)" },
  { valor: "CI", etiqueta: "Cédula de identidad" },
  { valor: "OTRO", etiqueta: "Otro" },
];

type Opcion = { id: string; nombre: string };

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  zonas: Opcion[];
  vendedores: Opcion[];
  arbolUbigeos: ArbolUbigeos;
  ubigeoSeleccionado?: UbigeoSeleccionado | null;
  /** Umbral de aprobación del límite de crédito; `null` = control apagado. */
  umbralAprobacionCredito?: number | null;
  valoresIniciales?: {
    razonSocial: string;
    nombreComercial: string | null;
    tipoDocumentoFiscal: string;
    ruc: string | null;
    pais: string;
    canal: string | null;
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
  arbolUbigeos,
  ubigeoSeleccionado,
  umbralAprobacionCredito = null,
  valoresIniciales,
  textoBoton,
}: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  // El campo del motivo aparece solo cuando hace falta. La decisión se repite
  // en el servidor sobre el límite guardado: esto es comodidad de pantalla, no
  // el control.
  const limiteInicial = valoresIniciales?.limiteCredito ?? 0;
  const [limite, setLimite] = useState(limiteInicial);
  const esAlta = !valoresIniciales;
  const aumentoNecesitaAprobacion = esAlta
    ? creacionRequiereAprobacion(limite, umbralAprobacionCredito)
    : decidirCambioLimiteCredito(limiteInicial, limite, umbralAprobacionCredito).requiereAprobacion;

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-2xl">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
          {estado.aviso}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Campo etiqueta="Tipo de documento">
                    <select
                      name="tipoDocumentoFiscal"
                      defaultValue={valoresIniciales?.tipoDocumentoFiscal ?? "RUC"}
                      className="campo-input"
                    >
                      {OPCIONES_DOCUMENTO_FISCAL.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="N° de documento">
                    <input
                      name="ruc"
                      defaultValue={valoresIniciales?.ruc ?? ""}
                      className="campo-input font-mono"
                    />
                  </Campo>
                  <Campo etiqueta="País">
                    <input
                      name="pais"
                      defaultValue={valoresIniciales?.pais ?? "Peru"}
                      className="campo-input"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Correo electrónico">
                  <input
                    name="email"
                    type="email"
                    defaultValue={valoresIniciales?.email ?? ""}
                    className="campo-input"
                  />
                </Campo>
                <Campo etiqueta="Canal comercial">
                  <select name="canal" defaultValue={valoresIniciales?.canal ?? ""} className="campo-input">
                    <option value="">Sin clasificar</option>
                    {CANALES.map((c) => (
                      <option key={c} value={c}>
                        {ETIQUETA_CANAL_CLIENTE[c]}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            ),
          },
          {
            id: "ubicacion",
            etiqueta: "Ubicación",
            contenido: (
              <div className="borde-seccion">
                <SelectorUbigeo
                  arbol={arbolUbigeos}
                  seleccionado={ubigeoSeleccionado}
                  textoHeredado={{
                    departamento: valoresIniciales?.departamento,
                    provincia: valoresIniciales?.provincia,
                    distrito: valoresIniciales?.distrito,
                  }}
                />
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="Límite de crédito S/ (0 = sin límite)">
                    <input
                      name="limiteCredito"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={limiteInicial}
                      onChange={(e) => setLimite(Number(e.target.value))}
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
                {aumentoNecesitaAprobacion && (esAlta ? (
                  <p className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
                    Un límite de S/ {limite === 0 ? "sin tope" : limite} supera el umbral que
                    requiere aprobación. Dé de alta el cliente con un límite dentro del umbral y
                    solicite el aumento desde su ficha.
                  </p>
                ) : (
                  <Campo etiqueta="Motivo del aumento del límite">
                    <textarea
                      name="motivoLimiteCredito"
                      rows={2}
                      maxLength={500}
                      className="campo-input"
                      placeholder="Historial de pago, garantía recibida, crecimiento de compras…"
                    />
                    <p className="mt-1 text-xs text-[var(--epicor-texto-tenue)]">
                      Este aumento requiere aprobación: el resto de la ficha se guarda ahora y el
                      límite se mantiene en S/ {limiteInicial} hasta que Gerencia lo resuelva.
                    </p>
                  </Campo>
                ))}
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
