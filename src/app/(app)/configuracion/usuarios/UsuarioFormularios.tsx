"use client";

import { useRef } from "react";
import { useActionState } from "react";
import {
  crearUsuario,
  restablecerPassword,
  asignarGrupoUsuario,
  type EstadoFormulario,
} from "./actions";

type GrupoOpcion = { id: string; nombre: string };

export function CrearUsuarioFormulario({ grupos }: { grupos: GrupoOpcion[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await crearUsuario(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {estado.error && <MensajeError texto={estado.error} />}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <input name="nombre" required placeholder="Nombre completo" className="campo-input" />
        <input name="usuario" required placeholder="usuario de acceso" className="campo-input font-mono" />
        <input
          name="password"
          type="password"
          required
          placeholder="Contraseña (mín. 8)"
          className="campo-input"
        />
        <select name="rol" required defaultValue="" className="campo-input">
          <option value="" disabled>
            Rol
          </option>
          <option value="ADMIN">Administrador</option>
          <option value="ALMACEN">Almacén</option>
          <option value="PRODUCCION">Producción</option>
          <option value="VENTAS">Ventas</option>
        </select>
        <select name="grupoSeguridadId" defaultValue="" className="campo-input">
          <option value="">Sin grupo (solo el rol)</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={enviando} className="boton-primario self-start">
        {enviando ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}

export function GrupoUsuarioFormulario({
  usuarioId,
  grupoActualId,
  grupos,
}: {
  usuarioId: string;
  grupoActualId: string | null;
  grupos: GrupoOpcion[];
}) {
  return (
    <select
      defaultValue={grupoActualId ?? ""}
      onChange={(e) => {
        asignarGrupoUsuario(usuarioId, e.currentTarget.value || null);
      }}
      className="campo-input text-xs py-1"
    >
      <option value="">Sin grupo (solo el rol)</option>
      {grupos.map((g) => (
        <option key={g.id} value={g.id}>
          {g.nombre}
        </option>
      ))}
    </select>
  );
}

export function RestablecerPasswordFormulario({ usuarioId }: { usuarioId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const accion = restablecerPassword.bind(null, usuarioId);
  const [estado, formAction, enviando] = useActionState(
    async (prev: EstadoFormulario, formData: FormData) => {
      const resultado = await accion(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2 justify-end">
      {estado.error && <span className="text-xs text-red-600 dark:text-red-400">{estado.error}</span>}
      <input
        name="password"
        type="password"
        required
        placeholder="Nueva contraseña"
        className="campo-input text-xs py-1 w-36"
      />
      <button
        type="submit"
        disabled={enviando}
        className="text-neutral-600 dark:text-neutral-400 hover:underline text-sm whitespace-nowrap"
      >
        {enviando ? "..." : "Restablecer"}
      </button>
    </form>
  );
}

function MensajeError({ texto }: { texto: string }) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
      {texto}
    </p>
  );
}
