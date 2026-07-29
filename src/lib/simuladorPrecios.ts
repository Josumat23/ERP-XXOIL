// ---------------------------------------------------------------------------
// Simulador de precios y meta de utilidad (estilo Business Management Game:
// "¿a qué precio vendo este trimestre para ganar X, sin perder ventas frente
// al competidor y sin quedarme sin materia prima ni capacidad?"). Funciones
// puras (sin Prisma) para poder usarlas también desde un componente cliente.
// ---------------------------------------------------------------------------

export type LineaSimulada = {
  presentacionId: string;
  nombre: string;
  costoPromedio: number;
  demandaProyectada: number;
  precioActual: number;
  precioSimulado: number;
  precioCompetidorRef: number | null;
};

export function margenPct(precio: number, costo: number): number {
  return precio > 0 ? ((precio - costo) / precio) * 100 : 0;
}

// Positivo = vendo más caro que el competidor; negativo = más barato.
export function brechaCompetidorPct(precio: number, precioCompetidor: number | null): number | null {
  if (precioCompetidor == null || precioCompetidor <= 0) return null;
  return ((precio - precioCompetidor) / precioCompetidor) * 100;
}

export type ResumenSimulacion = {
  ventasSimuladas: number;
  comisionesSimuladas: number;
  utilidadBrutaSimulada: number;
  utilidadOperativaSimulada: number;
  diferenciaVsMeta: number | null;
};

export function calcularResumenSimulacion(
  lineas: LineaSimulada[],
  costoVentasProyectado: number,
  tasaComisionPromedio: number,
  gastosOperativosProyectados: number,
  metaUtilidadOperativa: number | null
): ResumenSimulacion {
  const ventasSimuladas = lineas.reduce((acc, l) => acc + l.demandaProyectada * l.precioSimulado, 0);
  const comisionesSimuladas = ventasSimuladas * tasaComisionPromedio;
  const utilidadBrutaSimulada = ventasSimuladas - costoVentasProyectado;
  const utilidadOperativaSimulada = utilidadBrutaSimulada - comisionesSimuladas - gastosOperativosProyectados;
  return {
    ventasSimuladas,
    comisionesSimuladas,
    utilidadBrutaSimulada,
    utilidadOperativaSimulada,
    diferenciaVsMeta:
      metaUtilidadOperativa != null ? utilidadOperativaSimulada - metaUtilidadOperativa : null,
  };
}

/**
 * Factor uniforme (ej. 1.05 = subir todos los precios actuales 5%) necesario
 * para que la utilidad operativa alcance exactamente la meta, asumiendo el
 * mismo volumen proyectado y el mismo % de comisión sobre ventas. Es un
 * despeje lineal (target pricing), no una optimización de elasticidad —
 * sirve como punto de partida, no como precio final.
 */
export function factorPrecioParaMeta(
  ventasBase: number,
  comisionesBase: number,
  costoVentasProyectado: number,
  gastosOperativosProyectados: number,
  metaUtilidadOperativa: number
): number | null {
  const denominador = ventasBase - comisionesBase;
  if (denominador <= 0) return null;
  return (metaUtilidadOperativa + costoVentasProyectado + gastosOperativosProyectados) / denominador;
}
