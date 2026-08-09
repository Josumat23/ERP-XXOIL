export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="max-w-6xl animate-pulse">
      <span className="sr-only">Cargando pantalla</span>
      <div aria-hidden="true">
        <div className="h-8 w-56 rounded-lg bg-[var(--epicor-borde)]" />
        <div className="mt-2 h-4 w-32 rounded bg-[var(--epicor-borde-suave)]" />

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, indice) => (
            <div key={indice} className="h-28 rounded-xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-4">
              <div className="h-3 w-24 rounded bg-[var(--epicor-borde)]" />
              <div className="mt-4 h-7 w-32 rounded bg-[var(--epicor-borde-suave)]" />
              <div className="mt-3 h-3 w-20 rounded bg-[var(--epicor-borde-suave)]" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-4">
          <div className="h-5 w-44 rounded bg-[var(--epicor-borde)]" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, indice) => (
              <div key={indice} className="h-9 rounded-lg bg-[var(--epicor-borde-suave)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
