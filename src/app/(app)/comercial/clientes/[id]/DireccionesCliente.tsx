"use client";

import { useActionState, useState } from "react";
import SelectorUbigeo from "@/components/SelectorUbigeo";
import type { ArbolUbigeos } from "@/lib/ubigeos";
import {
  ETIQUETA_TIPO_DIRECCION,
  TIPOS_DIRECCION,
  type TipoDireccion,
} from "@/lib/direccionesCliente";
import { DIAS_SEMANA, minutosAHora, resumenDias } from "@/lib/logisticaCliente";
import {
  actualizarDireccion,
  crearDireccion,
  desactivarDireccion,
  type EstadoFormulario,
} from "./direccionesActions";

export type DireccionVista = {
  id: string;
  tipo: string;
  principalDe: string | null;
  etiqueta: string | null;
  direccion: string;
  referencia: string | null;
  ubigeoId: string | null;
  ubigeo: { id: string; departamento: string; provincia: string; distrito: string } | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  codigoPostal: string | null;
  pais: string;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  latitud: string | null;
  longitud: string | null;
  activa: boolean;
  notas: string | null;
  ventanaInicioMin: number | null;
  ventanaFinMin: number | null;
  recibeLunes: boolean;
  recibeMartes: boolean;
  recibeMiercoles: boolean;
  recibeJueves: boolean;
  recibeViernes: boolean;
  recibeSabado: boolean;
  recibeDomingo: boolean;
  requisitosEntrega: string | null;
  restriccionesVehiculares: string | null;
};

const COLOR_TIPO: Record<string, string> = {
  FISCAL: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  FACTURACION: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-400",
  ENTREGA: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  COBRANZA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{etiqueta}</span>
      {children}
    </label>
  );
}

function Formulario({
  arbol,
  direccion,
  accion,
  textoBoton,
  onListo,
}: {
  arbol: ArbolUbigeos;
  direccion?: DireccionVista;
  accion: (prev: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  textoBoton: string;
  onListo: () => void;
}) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async (prev, datos) => {
      const resultado = await accion(prev, datos);
      if (!resultado.error) onListo();
      return resultado;
    },
    {}
  );
  const [tipo, setTipo] = useState<string>(direccion?.tipo ?? "ENTREGA");

  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Para qué sirve *">
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="campo-input"
        >
          {TIPOS_DIRECCION.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_DIRECCION[t as TipoDireccion]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Cómo la llaman">
        <input
          name="etiqueta"
          defaultValue={direccion?.etiqueta ?? ""}
          maxLength={120}
          className="campo-input"
          placeholder="Planta Toquepala, Almacén Central..."
        />
      </Campo>

      <div className="sm:col-span-2">
        <Campo etiqueta="Dirección *">
          <textarea
            name="direccion"
            required
            maxLength={500}
            rows={2}
            defaultValue={direccion?.direccion ?? ""}
            className="campo-input"
          />
        </Campo>
      </div>

      <Campo etiqueta="Referencia">
        <input
          name="referencia"
          defaultValue={direccion?.referencia ?? ""}
          maxLength={300}
          className="campo-input"
          placeholder="Frente al grifo, portón azul..."
        />
      </Campo>

      <Campo etiqueta="Código postal">
        <input
          name="codigoPostal"
          defaultValue={direccion?.codigoPostal ?? ""}
          maxLength={20}
          className="campo-input"
        />
      </Campo>

      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Distrito {tipo === "ENTREGA" && <span className="text-red-600">*</span>}
        </span>
        {tipo === "ENTREGA" && (
          <p className="mb-1 text-xs text-neutral-500">
            El reparto agrupa por distrito y la licitación de flete cotiza por tramo: una dirección
            de entrega sin distrito no se puede planificar.
          </p>
        )}
        <SelectorUbigeo
          arbol={arbol}
          seleccionado={direccion?.ubigeo ?? null}
          textoHeredado={{
            departamento: direccion?.departamento,
            provincia: direccion?.provincia,
            distrito: direccion?.distrito,
          }}
        />
      </div>

      <Campo etiqueta="País">
        <input
          name="pais"
          defaultValue={direccion?.pais ?? "Peru"}
          maxLength={60}
          className="campo-input"
        />
      </Campo>

      <Campo etiqueta="Quién recibe">
        <input
          name="contactoNombre"
          defaultValue={direccion?.contactoNombre ?? ""}
          maxLength={120}
          className="campo-input"
        />
      </Campo>

      <Campo etiqueta="Teléfono de esa dirección">
        <input
          name="contactoTelefono"
          defaultValue={direccion?.contactoTelefono ?? ""}
          maxLength={40}
          className="campo-input"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Latitud">
          <input
            name="latitud"
            defaultValue={direccion?.latitud ?? ""}
            className="campo-input"
            placeholder="-17.1905"
          />
        </Campo>
        <Campo etiqueta="Longitud">
          <input
            name="longitud"
            defaultValue={direccion?.longitud ?? ""}
            className="campo-input"
            placeholder="-70.6012"
          />
        </Campo>
      </div>

      {tipo === "ENTREGA" && (
        <div className="sm:col-span-2 rounded-lg border border-[var(--epicor-borde)] p-3">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Cuándo y cómo se puede entregar acá
          </p>
          <p className="mb-2 text-xs text-neutral-500">
            Es lo que el transportista necesita saber antes de salir.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Recibe desde">
              <input
                name="ventanaInicio"
                type="time"
                defaultValue={minutosAHora(direccion?.ventanaInicioMin ?? null)}
                className="campo-input"
              />
            </Campo>
            <Campo etiqueta="Recibe hasta">
              <input
                name="ventanaFin"
                type="time"
                defaultValue={minutosAHora(direccion?.ventanaFinMin ?? null)}
                className="campo-input"
              />
            </Campo>
          </div>
          <div className="mt-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Días de recepción
            </span>
            <div className="mt-1 flex flex-wrap gap-3">
              {DIAS_SEMANA.map((d) => (
                <label key={d.campo} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    name={d.campo}
                    defaultChecked={direccion ? direccion[d.campo] : d.numero !== 7}
                  />
                  <span>{d.etiqueta}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Requisitos de entrega">
              <input
                name="requisitosEntrega"
                maxLength={300}
                defaultValue={direccion?.requisitosEntrega ?? ""}
                className="campo-input"
                placeholder="Guía sellada, EPP, inducción, aviso previo"
              />
            </Campo>
            <Campo etiqueta="Restricciones vehiculares">
              <input
                name="restriccionesVehiculares"
                maxLength={300}
                defaultValue={direccion?.restriccionesVehiculares ?? ""}
                className="campo-input"
                placeholder="No entra camión de 3 ejes; altura máx. 3.8 m"
              />
            </Campo>
          </div>
        </div>
      )}

      <div className="sm:col-span-2">
        <Campo etiqueta="Notas">
          <input
            name="notas"
            defaultValue={direccion?.notas ?? ""}
            maxLength={300}
            className="campo-input"
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="principal"
            defaultChecked={direccion ? direccion.principalDe !== null : true}
          />
          <span>Principal de su tipo</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activa"
            defaultChecked={direccion?.activa ?? true}
            value="on"
          />
          <span>Activa</span>
        </label>
      </div>

      {estado.error && (
        <p role="alert" className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Guardando..." : textoBoton}
        </button>
        <button type="button" onClick={onListo} className="boton-secundario">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BotonDesactivar({ direccionId }: { direccionId: string }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async () => desactivarDireccion(direccionId),
    {}
  );
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={enviando}
        className="text-xs text-red-700 hover:underline dark:text-red-400"
        title="La dirección deja de ofrecerse, pero los pedidos que la citan conservan su destino"
      >
        {enviando ? "Desactivando..." : "Desactivar"}
      </button>
      {estado.error && (
        <span role="alert" className="ml-2 text-xs text-red-600">
          {estado.error}
        </span>
      )}
    </form>
  );
}

export default function DireccionesCliente({
  clienteId,
  direcciones,
  arbol,
  faltantes,
  puedeEditar,
}: {
  clienteId: string;
  direcciones: DireccionVista[];
  arbol: ArbolUbigeos;
  faltantes: string[];
  puedeEditar: boolean;
}) {
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <section className="borde-seccion">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="titulo-seccion">Direcciones</h2>
        {puedeEditar && !agregando && (
          <button type="button" onClick={() => setAgregando(true)} className="boton-secundario text-sm">
            Agregar dirección
          </button>
        )}
      </div>

      {faltantes.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Falta declarar {faltantes.map((f) => ETIQUETA_TIPO_DIRECCION[f as TipoDireccion]).join(" y ")}.
          Sin domicilio fiscal no hay comprobante, y sin dirección de entrega no se puede despachar.
        </p>
      )}

      {agregando && (
        <div className="mt-3 rounded-lg border border-[var(--epicor-borde)] p-3">
          <h3 className="text-sm font-medium">Nueva dirección</h3>
          <Formulario
            arbol={arbol}
            accion={crearDireccion.bind(null, clienteId)}
            textoBoton="Agregar"
            onListo={() => setAgregando(false)}
          />
        </div>
      )}

      {direcciones.length === 0 && !agregando && (
        <p className="mt-3 text-sm text-neutral-500">Este cliente todavía no tiene direcciones.</p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {direcciones.map((d) => (
          <div
            key={d.id}
            className={`rounded-lg border p-3 ${
              d.activa
                ? "border-[var(--epicor-borde)]"
                : "border-dashed border-neutral-300 opacity-60 dark:border-neutral-700"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className={`insignia ${COLOR_TIPO[d.tipo]}`}>
                  {ETIQUETA_TIPO_DIRECCION[d.tipo as TipoDireccion]}
                </span>
                {d.principalDe !== null && (
                  <span className="ml-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Principal
                  </span>
                )}
                {!d.activa && <span className="ml-2 text-xs text-neutral-500">Inactiva</span>}
                {d.etiqueta && (
                  <span className="ml-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {d.etiqueta}
                  </span>
                )}
              </div>
              {puedeEditar && d.activa && editandoId !== d.id && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditandoId(d.id)}
                    className="text-xs text-[var(--epicor-azul)] hover:underline"
                  >
                    Editar
                  </button>
                  <BotonDesactivar direccionId={d.id} />
                </div>
              )}
            </div>

            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{d.direccion}</p>
            <p className="text-xs text-neutral-500">
              {d.ubigeo
                ? `${d.ubigeo.distrito}, ${d.ubigeo.provincia}, ${d.ubigeo.departamento}`
                : [d.distrito, d.provincia, d.departamento].filter(Boolean).join(", ") || "Sin distrito"}
              {d.pais && ` · ${d.pais}`}
              {d.referencia && ` · ${d.referencia}`}
            </p>
            {(d.contactoNombre || d.contactoTelefono) && (
              <p className="text-xs text-neutral-500">
                Recibe: {d.contactoNombre ?? "—"}
                {d.contactoTelefono && ` · ${d.contactoTelefono}`}
              </p>
            )}
            {d.tipo === "ENTREGA" && (
              <p className="text-xs text-neutral-500">
                {resumenDias(d)}
                {d.ventanaInicioMin !== null && d.ventanaFinMin !== null
                  ? ` · ${minutosAHora(d.ventanaInicioMin)} a ${minutosAHora(d.ventanaFinMin)}`
                  : " · a cualquier hora"}
                {d.requisitosEntrega && ` · ${d.requisitosEntrega}`}
                {d.restriccionesVehiculares && ` · ${d.restriccionesVehiculares}`}
              </p>
            )}
            {d.latitud && d.longitud && (
              <p className="font-mono text-xs text-neutral-400">
                {d.latitud}, {d.longitud}
              </p>
            )}

            {editandoId === d.id && (
              <Formulario
                arbol={arbol}
                direccion={d}
                accion={actualizarDireccion.bind(null, d.id)}
                textoBoton="Guardar cambios"
                onListo={() => setEditandoId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
