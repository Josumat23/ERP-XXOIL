"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center">
      <div className="w-full rounded-2xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-6 text-center shadow-[var(--sombra-suave)] sm:p-10">
        <span aria-hidden="true" className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-700 dark:bg-red-950 dark:text-red-300">
          !
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[var(--epicor-texto)]">
          No pudimos cargar esta pantalla
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--epicor-texto-tenue)]">
          Puede tratarse de un problema temporal. Intente nuevamente; sus datos ingresados en otras pantallas no se modificarán.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-[var(--epicor-texto-tenue)]">
            Referencia: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Link href="/" className="boton-secundario min-h-10 inline-flex items-center justify-center">
            Volver al panel
          </Link>
          <button type="button" onClick={() => retry()} className="boton-primario min-h-10">
            Intentar nuevamente
          </button>
        </div>
      </div>
    </section>
  );
}
