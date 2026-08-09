"use client";

import { useState } from "react";
import { useActionState } from "react";
import { guardarConfiguracionEmpresa, type EstadoFormulario } from "./actions";

type Props = {
  valores: {
    razonSocial: string;
    nombreComercial: string | null;
    ruc: string | null;
    direccion: string | null;
    direccion2: string | null;
    ciudad: string | null;
    distrito: string | null;
    provincia: string | null;
    departamento: string | null;
    codigoPostal: string | null;
    pais: string;
    telefono: string | null;
    fax: string | null;
    email: string | null;
    sitioWeb: string | null;
    tasaIgv: number;
    registroHidrocarburosOsinergmin: string | null;
    registroHidrocarburosVigencia: string | null; // yyyy-mm-dd
    tarifaHoraManoObra: number;
    montoAprobacionCompras: number;
    montoAprobacionPagos: number;
    tasaDescuentoCxC: number;
    tasaCreditoCortoPlazo: number;
    limiteCreditoCortoPlazo: number;
    tasaCreditoLargoPlazo: number;
    tasaRecargoMora: number;
    oseProveedor: string;
    oseToken: string | null;
    sunatUsuarioSol: string | null;
    sunatClaveSol: string | null;
    sunatCertificadoPassword: string | null;
    tieneCertificado: boolean;
  };
};

export default function EmpresaFormulario({ valores }: Props) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    guardarConfiguracionEmpresa,
    {}
  );
  const [oseProveedor, setOseProveedor] = useState(valores.oseProveedor);

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-2xl">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-md px-3 py-2">
          Configuración guardada. Los documentos nuevos usarán estos datos.
        </p>
      )}

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Datos fiscales</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Razón social *">
            <input name="razonSocial" required defaultValue={valores.razonSocial} className="campo-input" />
          </Campo>
          <Campo etiqueta="Nombre comercial">
            <input name="nombreComercial" defaultValue={valores.nombreComercial ?? ""} className="campo-input" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="RUC">
            <input name="ruc" maxLength={11} defaultValue={valores.ruc ?? ""} className="campo-input font-mono" />
          </Campo>
          <Campo etiqueta="Tasa de IGV (%)">
            <input
              name="tasaIgv"
              type="number"
              step="0.1"
              min="0"
              max="30"
              required
              defaultValue={valores.tasaIgv}
              className="campo-input"
            />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Registro de Hidrocarburos (OSINERGMIN)</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="N° de registro (OPDH)">
            <input
              name="registroHidrocarburosOsinergmin"
              defaultValue={valores.registroHidrocarburosOsinergmin ?? ""}
              placeholder="RHO-..."
              className="campo-input font-mono"
            />
          </Campo>
          <Campo etiqueta="Vigente hasta">
            <input
              name="registroHidrocarburosVigencia"
              type="date"
              defaultValue={valores.registroHidrocarburosVigencia ?? ""}
              className="campo-input"
            />
          </Campo>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Fabricar y comercializar lubricantes en Perú requiere inscripción en el Registro de
          Hidrocarburos de OSINERGMIN (categoría OPDH). Referencia informativa: no bloquea ninguna
          operación del sistema.
        </p>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Dirección (aparece en los documentos impresos)</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Dirección">
            <input name="direccion" defaultValue={valores.direccion ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Dirección (línea 2)">
            <input name="direccion2" defaultValue={valores.direccion2 ?? ""} className="campo-input" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo etiqueta="Distrito">
            <input name="distrito" defaultValue={valores.distrito ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Provincia">
            <input name="provincia" defaultValue={valores.provincia ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Departamento">
            <input name="departamento" defaultValue={valores.departamento ?? ""} className="campo-input" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo etiqueta="Ciudad">
            <input name="ciudad" defaultValue={valores.ciudad ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Código postal">
            <input name="codigoPostal" defaultValue={valores.codigoPostal ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="País">
            <input name="pais" defaultValue={valores.pais} className="campo-input" />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Contacto</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Teléfono">
            <input name="telefono" defaultValue={valores.telefono ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Fax">
            <input name="fax" defaultValue={valores.fax ?? ""} className="campo-input" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Correo electrónico">
            <input name="email" type="email" defaultValue={valores.email ?? ""} className="campo-input" />
          </Campo>
          <Campo etiqueta="Sitio web">
            <input name="sitioWeb" defaultValue={valores.sitioWeb ?? ""} className="campo-input" />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Costeo de producción</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Tarifa de mano de obra (S/ por hora)">
            <input
              name="tarifaHoraManoObra"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={valores.tarifaHoraManoObra}
              className="campo-input"
            />
          </Campo>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Se usa para calcular el costo de mano de obra al finalizar lotes y envasados (horas
          registradas × esta tarifa vigente al momento). La capacidad disponible para el chequeo
          de Proyecciones → Operaciones se configura por almacén en Configuración → Almacenes
          (calendario de producción).
        </p>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Aprobaciones por monto</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Compras a partir de (S/)">
            <input
              name="montoAprobacionCompras"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={valores.montoAprobacionCompras}
              className="campo-input"
            />
          </Campo>
          <Campo etiqueta="Pagos a partir de (S/)">
            <input
              name="montoAprobacionPagos"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={valores.montoAprobacionPagos}
              className="campo-input"
            />
          </Campo>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Órdenes de compra y pagos a proveedores por encima de estos montos quedan pendientes de
          aprobación de Gerencia antes de poder recepcionarse / ejecutarse.
        </p>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Financiamiento (para Proyecciones → Finanzas)</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo etiqueta="Tasa descuento de CxC (%)">
            <input
              name="tasaDescuentoCxC"
              type="number"
              step="0.01"
              min="0"
              defaultValue={valores.tasaDescuentoCxC}
              className="campo-input"
            />
          </Campo>
          <Campo etiqueta="Tasa crédito corto plazo (%)">
            <input
              name="tasaCreditoCortoPlazo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={valores.tasaCreditoCortoPlazo}
              className="campo-input"
            />
          </Campo>
          <Campo etiqueta="Límite crédito corto plazo (S/)">
            <input
              name="limiteCreditoCortoPlazo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={valores.limiteCreditoCortoPlazo}
              className="campo-input"
            />
          </Campo>
          <Campo etiqueta="Tasa crédito largo plazo (%)">
            <input
              name="tasaCreditoLargoPlazo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={valores.tasaCreditoLargoPlazo}
              className="campo-input"
            />
          </Campo>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Orden de la cascada de financiamiento cuando una proyección necesita cubrir un déficit de
          caja: primero descuento de CxC, luego corto plazo (hasta el límite), y el resto a largo
          plazo.
        </p>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Recargo por mora</legend>
        <Campo etiqueta="Tasa mensual sobre facturas vencidas (%, 0 = no se cobra)">
          <input
            name="tasaRecargoMora"
            type="number"
            step="0.01"
            min="0"
            defaultValue={valores.tasaRecargoMora}
            className="campo-input w-40"
          />
        </Campo>
        <p className="text-xs text-neutral-500 mt-1">
          Se aplica manualmente desde el detalle de cada factura vencida — nunca de forma
          automática — y solo cobra los días de atraso no cobrados todavía.
        </p>
      </fieldset>

      <fieldset className="borde-seccion">
        <legend className="titulo-seccion">Facturación electrónica SUNAT</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Proveedor">
            <select
              name="oseProveedor"
              value={oseProveedor}
              onChange={(e) => setOseProveedor(e.target.value)}
              className="campo-input"
            >
              <option value="SIMULADO">Simulado (no envía nada real)</option>
              <option value="NUBEFACT">OSE — Nubefact</option>
              <option value="SUNAT_DIRECTO">Directo a SUNAT (SEE - Del Contribuyente)</option>
            </select>
          </Campo>
          {oseProveedor === "NUBEFACT" && (
            <Campo etiqueta="Token del proveedor">
              <input
                name="oseToken"
                type="password"
                defaultValue={valores.oseToken ?? ""}
                placeholder="Token que entrega el OSE al contratarlo"
                className="campo-input"
              />
            </Campo>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Usa el RUC de la sección &quot;Datos fiscales&quot; para autenticar. En &quot;Simulado&quot; el sistema
          completa el flujo (estado, historial) sin enviar nada real a SUNAT — útil para probar
          antes de contratar un proveedor real o de tener un certificado propio.
        </p>

        {oseProveedor === "SUNAT_DIRECTO" && (
          <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mb-3">
              Requiere un certificado digital real (.pfx/.p12) de una entidad certificadora
              acreditada a nombre de la empresa, y un usuario secundario SOL con facturación
              electrónica habilitada. Sin esto configurado, el envío directo fallará — no hay un
              modo simulado para este proveedor.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo etiqueta={`Certificado digital (.pfx/.p12)${valores.tieneCertificado ? " — ya hay uno cargado" : ""}`}>
                <input name="sunatCertificadoArchivo" type="file" accept=".pfx,.p12" className="campo-input" />
              </Campo>
              <Campo etiqueta="Contraseña del certificado">
                <input
                  name="sunatCertificadoPassword"
                  type="password"
                  defaultValue={valores.sunatCertificadoPassword ?? ""}
                  className="campo-input"
                />
              </Campo>
              <Campo etiqueta="Usuario secundario SOL">
                <input name="sunatUsuarioSol" defaultValue={valores.sunatUsuarioSol ?? ""} className="campo-input" />
              </Campo>
              <Campo etiqueta="Clave SOL">
                <input
                  name="sunatClaveSol"
                  type="password"
                  defaultValue={valores.sunatClaveSol ?? ""}
                  className="campo-input"
                />
              </Campo>
            </div>
          </div>
        )}
      </fieldset>

      <p className="text-xs text-neutral-500">
        La tasa de IGV se congela en cada factura al emitirla: cambiarla aquí no altera facturas ya
        emitidas.
      </p>

      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Guardando..." : "Guardar configuración"}
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
