"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { crearAlmacen, crearZonaAlmacen, type EstadoFormulario } from "./actions";
import { ETIQUETA_TIPO_ALMACEN } from "@/lib/tiposAlmacen";
import SelectorUbigeo from "@/components/SelectorUbigeo";
import type { ArbolUbigeos } from "@/lib/ubigeos";

export function AlmacenFormulario({ arbolUbigeos }: { arbolUbigeos: ArbolUbigeos }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearAlmacen(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <input aria-label="Código del almacén" name="codigo" required placeholder="Código (ej. PLANTA)" className="campo-input w-40 font-mono" />
        <input aria-label="Nombre del almacén" name="nombre" required placeholder="Nombre" className="campo-input flex-1 min-w-48" />
        <select aria-label="Rol organizativo" name="tipo" required defaultValue="ALMACEN_DISTRIBUCION" className="campo-input w-52">
          {Object.entries(ETIQUETA_TIPO_ALMACEN).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <input aria-label="Encargado del almacén" name="encargado" placeholder="Encargado (opcional)" className="campo-input flex-1 min-w-40" />
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <input aria-label="Dirección del almacén" name="direccion" placeholder="Dirección" className="campo-input flex-1 min-w-48" />
        <input aria-label="Segunda línea de dirección" name="direccion2" placeholder="Dirección (línea 2)" className="campo-input flex-1 min-w-40" />
      </div>
      <SelectorUbigeo arbol={arbolUbigeos} />
      <div className="flex flex-wrap gap-3 items-end">
        <input aria-label="Ciudad" name="ciudad" placeholder="Ciudad" className="campo-input flex-1 min-w-32" />
        <input aria-label="Código postal" name="codigoPostal" placeholder="Código postal" className="campo-input w-32" />
        <input aria-label="País" name="pais" placeholder="País" defaultValue="Perú" className="campo-input w-28" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar almacén"}
        </button>
      </div>
    </form>
  );
}

type ZonaExistente = { id: string; almacenId: string; etiqueta: string };

export function ZonaFormulario({
  almacenes,
  zonas,
}: {
  almacenes: { id: string; nombre: string }[];
  zonas: ZonaExistente[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Solo se ofrecen zonas del almacén elegido: colgar un rack de un pasillo de
  // otro almacén dejaría una ubicación imposible de recorrer físicamente. El
  // servidor lo vuelve a verificar de todos modos.
  const [almacenElegido, setAlmacenElegido] = useState("");
  const zonasDelAlmacen = zonas.filter((z) => z.almacenId === almacenElegido);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearZonaAlmacen(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <select
          aria-label="Almacén"
          name="almacenId"
          required
          value={almacenElegido}
          onChange={(e) => setAlmacenElegido(e.target.value)}
          className="campo-input w-48"
        >
          <option value="" disabled>
            Almacén
          </option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <input aria-label="Código de la zona" name="codigo" required placeholder="Código (ej. A-01)" className="campo-input w-32 font-mono" />
        <input aria-label="Descripción de la zona" name="nombre" placeholder="Descripción (opcional)" className="campo-input flex-1 min-w-48" />
        <select
          aria-label="Zona superior"
          name="parentId"
          defaultValue=""
          disabled={zonasDelAlmacen.length === 0}
          className="campo-input w-56"
        >
          <option value="">Sin zona superior (raíz)</option>
          {zonasDelAlmacen.map((z) => (
            <option key={z.id} value={z.id}>
              Dentro de {z.etiqueta}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar zona"}
        </button>
      </div>
    </form>
  );
}
