"use client";

import { useActionState, useState } from "react";
import {
  adjudicarFlete,
  crearLicitacionFlete,
  declararDesierta,
  registrarOfertaFlete,
  type EstadoFormulario,
} from "./actions";

type Opcion = { id: string; etiqueta: string };

function Error({ estado }: { estado: EstadoFormulario }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
      {estado.error}
    </p>
  );
}

export function NuevaLicitacionFormulario({ ubigeos }: { ubigeos: Opcion[] }) {
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(
    crearLicitacionFlete,
    {}
  );

  return (
    <form action={formAction} className="borde-seccion flex flex-col gap-3">
      <h2 className="titulo-seccion">Nueva licitación de flete</h2>
      <Error estado={estado} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Título *</span>
          <input
            name="titulo"
            required
            className="campo-input"
            placeholder="Despacho quincenal a Trujillo"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Origen *</span>
          <input name="origen" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Destino *</span>
          <input name="destino" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Ubigeo de origen
          </span>
          <select name="ubigeoOrigenId" defaultValue="" className="campo-input">
            <option value="">Sin especificar</option>
            {ubigeos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Ubigeo de destino
          </span>
          <select name="ubigeoDestinoId" defaultValue="" className="campo-input">
            <option value="">Sin especificar</option>
            {ubigeos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Peso estimado (kg) *
          </span>
          <input name="pesoEstimadoKg" type="number" step="0.01" min="0.01" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Fecha requerida *
          </span>
          <input name="fechaRequerida" type="date" required className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Cierre de ofertas (opcional)
          </span>
          <input name="fechaLimite" type="date" className="campo-input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Notas</span>
          <input name="notas" className="campo-input" placeholder="Carga paletizada, requiere furgón" />
        </label>
      </div>
      <div>
        <button type="submit" disabled={enviando} className="boton-primario text-sm">
          {enviando ? "Creando…" : "Crear licitación"}
        </button>
      </div>
    </form>
  );
}

export function OfertaFormulario({
  licitacionId,
  transportistas,
}: {
  licitacionId: string;
  transportistas: Opcion[];
}) {
  const accion = registrarOfertaFlete.bind(null, licitacionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});
  const [moneda, setMoneda] = useState("PEN");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Transportista</span>
        <select name="transportistaId" required defaultValue="" className="campo-input text-xs w-52">
          <option value="" disabled>
            Seleccione
          </option>
          {transportistas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Moneda</span>
        <select
          name="moneda"
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
          className="campo-input text-xs w-20"
        >
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Monto</span>
        <input name="monto" type="number" step="0.01" min="0.01" required className="campo-input text-xs w-28" />
      </label>
      {moneda !== "PEN" && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Tipo de cambio</span>
          <input name="tipoCambio" type="number" step="0.0001" min="0.0001" required className="campo-input text-xs w-24" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Días de tránsito</span>
        <input name="diasTransito" type="number" step="1" min="0" required className="campo-input text-xs w-24" />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Válida hasta</span>
        <input name="validaHasta" type="date" className="campo-input text-xs" />
      </label>
      <button type="submit" disabled={enviando} className="boton-secundario text-xs">
        {enviando ? "…" : "Registrar oferta"}
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function AdjudicarFormulario({
  licitacionId,
  ofertaId,
  esLaMasBarata,
  sobrecosto,
}: {
  licitacionId: string;
  ofertaId: string;
  esLaMasBarata: boolean;
  sobrecosto: number;
}) {
  const accion = adjudicarFlete.bind(null, licitacionId, ofertaId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">
          Justificación
          {!esLaMasBarata && (
            <span className="ml-1 text-amber-700 dark:text-amber-400">
              — no es la más barata: S/ {sobrecosto.toFixed(2)} por encima
            </span>
          )}
        </span>
        <input
          name="justificacion"
          required
          minLength={12}
          maxLength={1000}
          className="campo-input text-xs w-96"
          placeholder={
            esLaMasBarata
              ? "Por qué se adjudica a este transportista"
              : "Por qué se paga más que la oferta más barata"
          }
        />
      </label>
      <button type="submit" disabled={enviando} className="boton-primario text-xs">
        {enviando ? "…" : "Adjudicar"}
      </button>
      <Error estado={estado} />
    </form>
  );
}

export function DesiertaFormulario({ licitacionId }: { licitacionId: string }) {
  const accion = declararDesierta.bind(null, licitacionId);
  const [estado, formAction, enviando] = useActionState<EstadoFormulario, FormData>(accion, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-neutral-500">Motivo</span>
        <input name="motivo" required maxLength={500} className="campo-input text-xs w-72" />
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="boton-secundario text-xs text-red-700 dark:text-red-400"
      >
        {enviando ? "…" : "Declarar desierta"}
      </button>
      <Error estado={estado} />
    </form>
  );
}
