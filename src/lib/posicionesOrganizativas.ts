// Posiciones organizativas versionadas: una posición existe con independencia
// de quién la ocupe, y la ocupación es un período con inicio y fin opcional.
// Funciones puras sobre el listado completo, sin tocar la base — mismo patrón
// que jerarquiaCentrosCosto y ubicacionesTecnicas.

export type PeriodoAsignacion = {
  id: string;
  posicionId: string;
  empleadoId: string;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
};

export type NodoPosicion = { id: string; reportaAId: string | null };

/**
 * Un período cubre la fecha si empezó en o antes y no había terminado.
 * `vigenteHasta` es exclusivo: el día en que termina una ocupación es el
 * primer día de la siguiente, para que no existan dos ocupantes ese día.
 */
export function periodoCubreFecha(
  periodo: Pick<PeriodoAsignacion, "vigenteDesde" | "vigenteHasta">,
  fecha: Date,
): boolean {
  if (fecha < periodo.vigenteDesde) return false;
  return periodo.vigenteHasta === null || fecha < periodo.vigenteHasta;
}

/** Dos períodos se solapan si comparten al menos un instante. */
export function periodosSeSolapan(
  a: Pick<PeriodoAsignacion, "vigenteDesde" | "vigenteHasta">,
  b: Pick<PeriodoAsignacion, "vigenteDesde" | "vigenteHasta">,
): boolean {
  const finA = a.vigenteHasta?.getTime() ?? Number.POSITIVE_INFINITY;
  const finB = b.vigenteHasta?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.vigenteDesde.getTime() < finB && b.vigenteDesde.getTime() < finA;
}

/** Un período es válido si termina después de empezar. */
export function esPeriodoAsignacionValido(
  vigenteDesde: Date,
  vigenteHasta: Date | null,
): boolean {
  if (Number.isNaN(vigenteDesde.getTime())) return false;
  if (vigenteHasta === null) return true;
  if (Number.isNaN(vigenteHasta.getTime())) return false;
  return vigenteHasta > vigenteDesde;
}

/**
 * Una misma persona no puede ocupar la misma posición dos veces a la vez.
 * No se impide que ocupe posiciones distintas en paralelo ni que una posición
 * tenga varios ocupantes: eso es política de la empresa, no integridad de
 * datos, y el sistema no la inventa.
 */
export function haySolapamientoDeOcupacion(
  candidata: Pick<PeriodoAsignacion, "posicionId" | "empleadoId" | "vigenteDesde" | "vigenteHasta">,
  existentes: readonly PeriodoAsignacion[],
  ignorarId?: string,
): boolean {
  return existentes.some(
    (existente) =>
      existente.id !== ignorarId &&
      existente.posicionId === candidata.posicionId &&
      existente.empleadoId === candidata.empleadoId &&
      periodosSeSolapan(existente, candidata),
  );
}

/** Quiénes ocupaban la posición en esa fecha. */
export function ocupantesEnFecha(
  posicionId: string,
  fecha: Date,
  asignaciones: readonly PeriodoAsignacion[],
): string[] {
  return asignaciones
    .filter((a) => a.posicionId === posicionId && periodoCubreFecha(a, fecha))
    .map((a) => a.empleadoId);
}

/** Qué posiciones ocupaba la persona en esa fecha. */
export function posicionesDeEmpleadoEnFecha(
  empleadoId: string,
  fecha: Date,
  asignaciones: readonly PeriodoAsignacion[],
): string[] {
  return asignaciones
    .filter((a) => a.empleadoId === empleadoId && periodoCubreFecha(a, fecha))
    .map((a) => a.posicionId);
}

/** Posiciones sin ocupante en esa fecha. */
export function posicionesVacantesEnFecha(
  posicionIds: readonly string[],
  fecha: Date,
  asignaciones: readonly PeriodoAsignacion[],
): string[] {
  return posicionIds.filter((id) => ocupantesEnFecha(id, fecha, asignaciones).length === 0);
}

/** Colgar `posicionId` de `reportaAId` cerraría un ciclo en la jerarquía. */
export function creariaCicloPosicion(
  posicionId: string,
  reportaAId: string | null,
  posiciones: readonly NodoPosicion[],
): boolean {
  if (!reportaAId) return false;
  if (reportaAId === posicionId) return true;

  const superiorPorPosicion = new Map(posiciones.map((p) => [p.id, p.reportaAId]));
  const visitados = new Set<string>();
  let actual: string | null = reportaAId;
  while (actual) {
    if (actual === posicionId) return true;
    if (visitados.has(actual)) return true;
    visitados.add(actual);
    actual = superiorPorPosicion.get(actual) ?? null;
  }
  return false;
}

/**
 * Cadena de posiciones superiores a la indicada, de la más cercana a la más
 * alta. Corta ante un ciclo para no colgar a quien la recorra.
 */
export function cadenaDeMandoPosicion(
  posicionId: string,
  posiciones: readonly NodoPosicion[],
): string[] {
  const superiorPorPosicion = new Map(posiciones.map((p) => [p.id, p.reportaAId]));
  const cadena: string[] = [];
  const visitados = new Set<string>([posicionId]);
  let actual = superiorPorPosicion.get(posicionId) ?? null;
  while (actual && !visitados.has(actual)) {
    visitados.add(actual);
    cadena.push(actual);
    actual = superiorPorPosicion.get(actual) ?? null;
  }
  return cadena;
}
