"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { crearAlmacen, crearZonaAlmacen, type EstadoFormulario } from "./actions";

export function AlmacenFormulario() {
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
        <input name="codigo" required placeholder="Código (ej. PLANTA)" className="campo-input w-40 font-mono" />
        <input name="nombre" required placeholder="Nombre" className="campo-input flex-1 min-w-48" />
        <input name="encargado" placeholder="Encargado (opcional)" className="campo-input flex-1 min-w-40" />
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <input name="direccion" placeholder="Dirección" className="campo-input flex-1 min-w-48" />
        <input name="direccion2" placeholder="Dirección (línea 2)" className="campo-input flex-1 min-w-40" />
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <input name="distrito" placeholder="Distrito" className="campo-input flex-1 min-w-32" />
        <input name="provincia" placeholder="Provincia" className="campo-input flex-1 min-w-32" />
        <input name="departamento" placeholder="Departamento" className="campo-input flex-1 min-w-32" />
        <input name="ciudad" placeholder="Ciudad" className="campo-input flex-1 min-w-32" />
        <input name="codigoPostal" placeholder="Código postal" className="campo-input w-32" />
        <input name="pais" placeholder="País" defaultValue="Perú" className="campo-input w-28" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar almacén"}
        </button>
      </div>
    </form>
  );
}

export function ZonaFormulario({ almacenes }: { almacenes: { id: string; nombre: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
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
        <select name="almacenId" required defaultValue="" className="campo-input w-48">
          <option value="" disabled>
            Almacén
          </option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <input name="codigo" required placeholder="Código (ej. A-01)" className="campo-input w-32 font-mono" />
        <input name="nombre" placeholder="Descripción (opcional)" className="campo-input flex-1 min-w-48" />
        <button type="submit" disabled={enviando} className="boton-primario">
          {enviando ? "Creando..." : "Agregar zona"}
        </button>
      </div>
    </form>
  );
}
