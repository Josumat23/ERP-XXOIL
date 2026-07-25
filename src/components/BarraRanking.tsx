// Barra de ranking (magnitud, de mayor a menor): una sola serie, un solo
// matiz secuencial. Cuadrada en la base (el eje), redondeada en la punta
// (el extremo de datos) — nunca al revés.
export default function BarraRanking({
  etiqueta,
  valor,
  max,
  formatoValor = (v) => String(Math.round(v)),
}: {
  etiqueta: string;
  valor: number;
  max: number;
  formatoValor?: (valor: number) => string;
}) {
  const pct = max > 0 ? Math.max((valor / max) * 100, 2) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm text-neutral-600 dark:text-neutral-400" title={etiqueta}>
        {etiqueta}
      </span>
      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--epicor-borde-suave)" }}>
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: "var(--epicor-azul)",
            borderRadius: "0 9999px 9999px 0",
          }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
        {formatoValor(valor)}
      </span>
    </div>
  );
}
