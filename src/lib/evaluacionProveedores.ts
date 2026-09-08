export type IndicadoresProveedor = {
  tasaCalidad: number | null;
  retrasoPromedioDias: number | null;
  discrepanciaPrecioPromedioPct: number | null;
  muestras: number;
};

export function calcularPuntajeProveedor(indicadores: IndicadoresProveedor) {
  const dimensiones = [
    indicadores.tasaCalidad === null ? null : { peso: 0.4, valor: Math.max(0, Math.min(100, indicadores.tasaCalidad * 100)) },
    indicadores.retrasoPromedioDias === null ? null : { peso: 0.35, valor: Math.max(0, 100 - Math.max(0, indicadores.retrasoPromedioDias) * 5) },
    indicadores.discrepanciaPrecioPromedioPct === null ? null : { peso: 0.25, valor: Math.max(0, 100 - Math.abs(indicadores.discrepanciaPrecioPromedioPct) * 2) },
  ].filter((dimension): dimension is { peso: number; valor: number } => dimension !== null);
  if (!dimensiones.length) return { puntaje: null, categoria: "SIN_DATOS" as const, confianza: "SIN_DATOS" as const };
  const peso = dimensiones.reduce((suma, dimension) => suma + dimension.peso, 0);
  const puntaje = dimensiones.reduce((suma, dimension) => suma + dimension.valor * dimension.peso, 0) / peso;
  const categoria = puntaje >= 90 ? "A" : puntaje >= 75 ? "B" : puntaje >= 60 ? "C" : "D";
  const confianza = indicadores.muestras >= 10 ? "ALTA" : indicadores.muestras >= 3 ? "MEDIA" : "BAJA";
  return { puntaje, categoria, confianza };
}
