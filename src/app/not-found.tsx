import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6 bg-[radial-gradient(circle_at_top_left,var(--epicor-seleccion),transparent_45%)]">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-7 text-center shadow-[var(--sombra-media)] sm:p-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--epicor-azul)]">ERROR 404</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--epicor-texto)]">Página no encontrada</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--epicor-texto-tenue)]">
          La dirección puede ser incorrecta o la pantalla ya no está disponible para este enlace.
        </p>
        <Link href="/" className="boton-primario mt-7 inline-flex min-h-10 items-center justify-center">
          Ir al panel principal
        </Link>
      </section>
    </main>
  );
}
