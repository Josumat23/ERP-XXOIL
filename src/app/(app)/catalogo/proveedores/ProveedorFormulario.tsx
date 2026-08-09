"use client";

import { useActionState } from "react";
import FichaTabs from "@/components/FichaTabs";
import type { EstadoFormulario } from "./actions";

const OPCIONES_DOCUMENTO_FISCAL = [
  { valor: "RUC", etiqueta: "RUC (Perú)" },
  { valor: "RUT", etiqueta: "RUT (Chile)" },
  { valor: "NIT", etiqueta: "NIT (Colombia)" },
  { valor: "RFC", etiqueta: "RFC (México)" },
  { valor: "EIN", etiqueta: "EIN (Estados Unidos)" },
  { valor: "VAT", etiqueta: "VAT (Unión Europea)" },
  { valor: "CI", etiqueta: "Cédula de identidad" },
  { valor: "OTRO", etiqueta: "Otro" },
];

type Props = {
  accion: (prevState: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valoresIniciales?: {
    razonSocial: string;
    tipoDocumentoFiscal: string;
    ruc: string | null;
    pais: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    contactoNombre: string | null;
    contactoTelefono: string | null;
    cuentaBancaria: string | null;
    banco: string | null;
    numeroCuenta: string | null;
    cci: string | null;
    swift: string | null;
    iban: string | null;
    condicionPagoDias: number;
    notas: string | null;
  };
  textoBoton: string;
};

export default function ProveedorFormulario({ accion, valoresIniciales, textoBoton }: Props) {
  const [estado, formAction, enviando] = useActionState(accion, {});

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-2xl">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
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
                <Campo etiqueta="Razón social *">
                  <input
                    name="razonSocial"
                    required
                    defaultValue={valoresIniciales?.razonSocial}
                    className="campo-input"
                  />
                </Campo>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Campo etiqueta="Tipo de documento fiscal">
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
                      placeholder="20123456789"
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
            id: "pago",
            etiqueta: "Condiciones de pago",
            contenido: (
              <div className="borde-seccion">
                <Campo etiqueta="Condición habitual">
                  <select
                    name="condicionPagoDias"
                    defaultValue={String(valoresIniciales?.condicionPagoDias ?? 0)}
                    className="campo-input max-w-xs"
                  >
                    <option value="0">Contado</option>
                    <option value="15">Crédito 15 días</option>
                    <option value="30">Crédito 30 días</option>
                    <option value="45">Crédito 45 días</option>
                    <option value="60">Crédito 60 días</option>
                  </select>
                </Campo>

                <p className="text-xs font-medium text-neutral-500 mt-4 mb-1">
                  Datos bancarios para pagos domésticos (Perú)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="Banco">
                    <input
                      name="banco"
                      defaultValue={valoresIniciales?.banco ?? ""}
                      placeholder="BCP"
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="N° de cuenta">
                    <input
                      name="numeroCuenta"
                      defaultValue={valoresIniciales?.numeroCuenta ?? ""}
                      className="campo-input"
                    />
                  </Campo>
                  <Campo etiqueta="CCI">
                    <input
                      name="cci"
                      defaultValue={valoresIniciales?.cci ?? ""}
                      placeholder="002-191-001234567089-12"
                      className="campo-input font-mono"
                    />
                  </Campo>
                </div>

                <p className="text-xs font-medium text-neutral-500 mt-4 mb-1">
                  Para transferencias internacionales
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo etiqueta="SWIFT / BIC">
                    <input
                      name="swift"
                      defaultValue={valoresIniciales?.swift ?? ""}
                      placeholder="BCPLPEPL"
                      className="campo-input font-mono"
                    />
                  </Campo>
                  <Campo etiqueta="IBAN">
                    <input
                      name="iban"
                      defaultValue={valoresIniciales?.iban ?? ""}
                      className="campo-input font-mono"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Otros datos de pago (texto libre, opcional)">
                  <input
                    name="cuentaBancaria"
                    defaultValue={valoresIniciales?.cuentaBancaria ?? ""}
                    className="campo-input"
                  />
                </Campo>

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
