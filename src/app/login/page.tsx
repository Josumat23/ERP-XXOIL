"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(iniciarSesion, {});

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            ERP Grasas &amp; Lubricantes
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Ingrese con su cuenta para continuar</p>
        </div>

        <form
          action={formAction}
          className="flex flex-col gap-4 border border-black/10 dark:border-white/10 rounded-xl p-6"
        >
          {estado.error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
              {estado.error}
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Usuario</span>
            <input name="usuario" required autoFocus autoComplete="username" className="campo-input" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Contraseña</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="campo-input"
            />
          </label>

          <button type="submit" disabled={enviando} className="boton-primario mt-2">
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-xs text-neutral-400 text-center mt-4">
          Usuarios iniciales: admin, almacen, operario, ventas — clave: cambiar123
        </p>
      </div>
    </div>
  );
}
