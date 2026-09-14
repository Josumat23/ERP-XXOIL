"use client";

import { useActionState, useState } from "react";
import {
  CAMPO_PROPOSITO,
  ETIQUETA_PROPOSITO,
  PROPOSITOS,
  nombreCompleto,
  type Proposito,
} from "@/lib/contactosCliente";
import {
  actualizarContacto,
  crearContacto,
  desactivarContacto,
  type EstadoFormulario,
} from "./contactosActions";

export type ContactoVista = {
  id: string;
  nombres: string;
  apellidos: string | null;
  cargo: string | null;
  area: string | null;
  telefono: string | null;
  anexo: string | null;
  celular: string | null;
  email: string | null;
  paraPedidos: boolean;
  paraFacturacion: boolean;
  paraCobranza: boolean;
  paraDespacho: boolean;
  esPrincipal: boolean | null;
  activo: boolean;
  notas: string | null;
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
  contacto,
  accion,
  textoBoton,
  onListo,
}: {
  contacto?: ContactoVista;
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

  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Nombres *">
        <input
          name="nombres"
          required
          maxLength={120}
          defaultValue={contacto?.nombres ?? ""}
          className="campo-input"
        />
      </Campo>
      <Campo etiqueta="Apellidos">
        <input
          name="apellidos"
          maxLength={120}
          defaultValue={contacto?.apellidos ?? ""}
          className="campo-input"
        />
      </Campo>
      <Campo etiqueta="Cargo">
        <input
          name="cargo"
          maxLength={120}
          defaultValue={contacto?.cargo ?? ""}
          className="campo-input"
          placeholder="Jefe de compras"
        />
      </Campo>
      <Campo etiqueta="Área">
        <input
          name="area"
          maxLength={120}
          defaultValue={contacto?.area ?? ""}
          className="campo-input"
          placeholder="Logística"
        />
      </Campo>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Campo etiqueta="Teléfono">
            <input
              name="telefono"
              maxLength={40}
              defaultValue={contacto?.telefono ?? ""}
              className="campo-input"
            />
          </Campo>
        </div>
        <Campo etiqueta="Anexo">
          <input
            name="anexo"
            maxLength={10}
            defaultValue={contacto?.anexo ?? ""}
            className="campo-input"
          />
        </Campo>
      </div>
      <Campo etiqueta="Celular">
        <input
          name="celular"
          maxLength={40}
          defaultValue={contacto?.celular ?? ""}
          className="campo-input"
        />
      </Campo>

      <div className="sm:col-span-2">
        <Campo etiqueta="Correo">
          <input
            name="email"
            type="email"
            maxLength={160}
            defaultValue={contacto?.email ?? ""}
            className="campo-input"
          />
        </Campo>
      </div>

      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          ¿Para qué se le busca?
        </span>
        <p className="mb-1 text-xs text-neutral-500">
          Marcar un propósito exige teléfono, celular o correo: si no, nadie puede avisarle.
        </p>
        <div className="flex flex-wrap gap-4">
          {PROPOSITOS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={CAMPO_PROPOSITO[p]}
                defaultChecked={contacto?.[CAMPO_PROPOSITO[p]] ?? false}
              />
              <span>{ETIQUETA_PROPOSITO[p]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <Campo etiqueta="Notas">
          <input
            name="notas"
            maxLength={300}
            defaultValue={contacto?.notas ?? ""}
            className="campo-input"
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="principal"
            defaultChecked={contacto ? contacto.esPrincipal === true : false}
          />
          <span>Contacto principal</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" value="on" defaultChecked={contacto?.activo ?? true} />
          <span>Activo</span>
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

function BotonDesactivar({ contactoId }: { contactoId: string }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    async () => desactivarContacto(contactoId),
    {}
  );
  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={enviando}
        className="text-xs text-red-700 hover:underline dark:text-red-400"
        title="Deja de proponerse, y el histórico de avisos conserva su nombre"
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

export default function ContactosCliente({
  clienteId,
  contactos,
  sinAtender,
  puedeEditar,
}: {
  clienteId: string;
  contactos: ContactoVista[];
  sinAtender: string[];
  puedeEditar: boolean;
}) {
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <section className="borde-seccion">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="titulo-seccion">Contactos</h2>
        {puedeEditar && !agregando && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="boton-secundario text-sm"
          >
            Agregar contacto
          </button>
        )}
      </div>

      {sinAtender.length > 0 && contactos.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Nadie designado para{" "}
          {sinAtender.map((p) => ETIQUETA_PROPOSITO[p as Proposito].toLowerCase()).join(", ")}.
        </p>
      )}

      {agregando && (
        <div className="mt-3 rounded-lg border border-[var(--epicor-borde)] p-3">
          <h3 className="text-sm font-medium">Nuevo contacto</h3>
          <Formulario
            accion={crearContacto.bind(null, clienteId)}
            textoBoton="Agregar"
            onListo={() => setAgregando(false)}
          />
        </div>
      )}

      {contactos.length === 0 && !agregando && (
        <p className="mt-3 text-sm text-neutral-500">
          Este cliente todavía no tiene contactos registrados.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {contactos.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border p-3 ${
              c.activo
                ? "border-[var(--epicor-borde)]"
                : "border-dashed border-neutral-300 opacity-60 dark:border-neutral-700"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {nombreCompleto(c)}
                </span>
                {c.esPrincipal === true && (
                  <span className="ml-2 insignia bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400">
                    Principal
                  </span>
                )}
                {!c.activo && <span className="ml-2 text-xs text-neutral-500">Inactivo</span>}
                {(c.cargo || c.area) && (
                  <span className="ml-2 text-xs text-neutral-500">
                    {[c.cargo, c.area].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              {puedeEditar && c.activo && editandoId !== c.id && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditandoId(c.id)}
                    className="text-xs text-[var(--epicor-azul)] hover:underline"
                  >
                    Editar
                  </button>
                  <BotonDesactivar contactoId={c.id} />
                </div>
              )}
            </div>

            <p className="mt-1 text-xs text-neutral-500">
              {[
                c.telefono && `Tel. ${c.telefono}${c.anexo ? ` anexo ${c.anexo}` : ""}`,
                c.celular && `Cel. ${c.celular}`,
                c.email,
              ]
                .filter(Boolean)
                .join(" · ") || "Sin forma de contacto registrada"}
            </p>

            <div className="mt-1 flex flex-wrap gap-1">
              {PROPOSITOS.filter((p) => c[CAMPO_PROPOSITO[p]]).map((p) => (
                <span
                  key={p}
                  className="insignia bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {ETIQUETA_PROPOSITO[p]}
                </span>
              ))}
            </div>

            {c.notas && <p className="mt-1 text-xs text-neutral-500">{c.notas}</p>}

            {editandoId === c.id && (
              <Formulario
                contacto={c}
                accion={actualizarContacto.bind(null, c.id)}
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
