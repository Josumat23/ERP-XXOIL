type PuntoSerie = { etiqueta: string; valor: number };

// Gráfico de línea de una sola serie (tendencia en el tiempo): SVG estático,
// sin JS de cliente — el tooltip nativo (<title>) alcanza para el detalle por
// punto. Solo se etiqueta el último punto (el resto vive en el tooltip),
// siguiendo la regla de "nunca un número en cada punto".
export default function GraficoLinea({
  datos,
  formatoValor = (v) => String(Math.round(v)),
}: {
  datos: PuntoSerie[];
  formatoValor?: (valor: number) => string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const anchoSlot = 90;
  const altoPlot = 120;
  const margenSup = 26;
  const margenLat = 20;
  const anchoTotal = Math.max(datos.length - 1, 1) * anchoSlot + margenLat * 2;
  const altoTotal = margenSup + altoPlot + 22;
  const baseY = margenSup + altoPlot;

  const puntos = datos.map((d, i) => ({
    ...d,
    x: datos.length > 1 ? margenLat + i * anchoSlot : anchoTotal / 2,
    y: baseY - (d.valor / max) * (altoPlot - 12),
  }));

  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${linea} L${puntos[puntos.length - 1].x},${baseY} L${puntos[0].x},${baseY} Z`;
  const ultimo = puntos[puntos.length - 1];

  return (
    <svg
      viewBox={`0 0 ${anchoTotal} ${altoTotal}`}
      className="w-full h-auto"
      role="img"
      aria-label="Tendencia de ventas de los últimos meses"
    >
      <line x1={0} y1={baseY} x2={anchoTotal} y2={baseY} stroke="var(--epicor-borde)" strokeWidth={1} />
      <path d={area} fill="var(--epicor-azul)" opacity={0.1} />
      <path d={linea} fill="none" stroke="var(--epicor-azul)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p, i) => (
        <g key={i}>
          <title>{`${p.etiqueta}: ${formatoValor(p.valor)}`}</title>
          <circle cx={p.x} cy={p.y} r={4} fill="var(--epicor-azul)" stroke="var(--background)" strokeWidth={2} />
          <text x={p.x} y={baseY + 16} textAnchor="middle" fontSize={11} fill="var(--epicor-texto-tenue)">
            {p.etiqueta}
          </text>
        </g>
      ))}
      <text
        x={ultimo.x}
        y={Math.max(ultimo.y - 10, 12)}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="var(--epicor-texto)"
      >
        {formatoValor(ultimo.valor)}
      </text>
    </svg>
  );
}
