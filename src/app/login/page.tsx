"use client";

import { useActionState, useState } from "react";
import { iniciarSesion } from "./actions";

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(iniciarSesion, {});
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <main className="min-h-screen grid place-items-center overflow-x-hidden p-4 sm:p-8 bg-[radial-gradient(circle_at_top_left,var(--epicor-seleccion),transparent_45%)]">
      <div className="min-w-0 w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] shadow-[var(--sombra-media)] lg:grid lg:grid-cols-[1.05fr_1fr]">
        <section className="hidden min-w-0 lg:flex flex-col justify-between p-10 bg-[var(--epicor-azul)] text-white" aria-label="Información del sistema">
          <div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 font-bold tracking-wide ring-1 ring-white/25">
              GL
            </span>
            <h1 className="mt-8 text-2xl xl:text-3xl font-semibold leading-tight">ERP Grasas &amp; Lubricantes</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
              Gestión integrada para ventas, inventario, producción, finanzas y operaciones.
            </p>
          </div>
          <p className="text-xs text-white/70">Acceso exclusivo para personal autorizado</p>
        </section>

        <section className="min-w-0 p-6 sm:p-10 lg:p-12">
          <div className="lg:hidden min-w-0 flex items-center gap-3 mb-8">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--epicor-azul)] text-white font-bold text-sm">GL</span>
            <div className="min-w-0">
              <h1 className="font-semibold text-[var(--epicor-texto)] truncate">ERP Grasas &amp; Lubricantes</h1>
              <p className="text-xs text-[var(--epicor-texto-tenue)]">Sistema de gestión</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-[var(--epicor-texto)]">Bienvenido</h2>
            <p className="text-sm text-[var(--epicor-texto-tenue)] mt-1.5">
              Ingrese sus credenciales para continuar.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-5">
            {estado.error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5">
                {estado.error}
              </p>
            )}

            <fieldset disabled={enviando} className="contents">
              <div className="flex flex-col gap-1.5 text-sm">
                <label htmlFor="usuario" className="font-medium text-[var(--epicor-texto)]">Usuario</label>
                <input id="usuario" name="usuario" required autoFocus autoComplete="username" className="campo-input min-h-11" />
              </div>

              <div className="flex flex-col gap-1.5 text-sm">
                <label htmlFor="password" className="font-medium text-[var(--epicor-texto)]">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={mostrarPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="campo-input min-h-11 w-full pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((visible) => !visible)}
                    aria-pressed={mostrarPassword}
                    className="absolute inset-y-0 right-2 px-2 text-xs font-medium text-[var(--epicor-azul)] hover:underline"
                  >
                    {mostrarPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <button type="submit" className="boton-primario min-h-11 mt-1">
                {enviando ? "Ingresando…" : "Ingresar"}
              </button>
            </fieldset>
            <p aria-live="polite" className="sr-only">
              {enviando ? "Validando credenciales" : ""}
            </p>
          </form>

          <p className="mt-7 text-center text-xs text-[var(--epicor-texto-tenue)]">
            Si no puede ingresar, contacte al administrador del sistema.
          </p>
        </section>
      </div>
    </main>
  );
}
