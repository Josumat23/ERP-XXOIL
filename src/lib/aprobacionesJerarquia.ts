// Quién puede resolver la solicitud de un empleado, más allá del permiso.
//
// El permiso (`rrhh: aprobar`) y la segregación (quien pide no resuelve) siguen
// siendo la puerta principal; esto se aplica ENCIMA. Funciones puras: reciben
// el organigrama completo y no tocan la base.

export type AlcanceAprobacion = "SIN_JERARQUIA" | "JEFE_DIRECTO" | "CADENA_MANDO";

export type RelacionMando = { id: string; jefeDirectoId: string | null };

export type MotivoRechazoJerarquia = "NO_ES_JEFE_DIRECTO" | "FUERA_DE_CADENA";

export const MENSAJE_RECHAZO_JERARQUIA: Record<MotivoRechazoJerarquia, string> = {
  NO_ES_JEFE_DIRECTO: "Solo el jefe directo del solicitante puede resolver esta solicitud.",
  FUERA_DE_CADENA: "Solo un superior del solicitante puede resolver esta solicitud.",
};

/**
 * Cadena de mando de un empleado, del jefe directo hacia arriba. Corta ante un
 * ciclo para no colgar a quien la recorra: la alta de empleados ya impide
 * crearlos, pero un dato heredado no debe bloquear una aprobación.
 */
export function cadenaDeMando(
  empleadoId: string,
  relaciones: readonly RelacionMando[],
): string[] {
  const jefePorEmpleado = new Map(relaciones.map((r) => [r.id, r.jefeDirectoId]));
  const cadena: string[] = [];
  const visitados = new Set<string>([empleadoId]);
  let actual = jefePorEmpleado.get(empleadoId) ?? null;
  while (actual && !visitados.has(actual)) {
    visitados.add(actual);
    cadena.push(actual);
    actual = jefePorEmpleado.get(actual) ?? null;
  }
  return cadena;
}

export type ConsultaJerarquia = {
  alcance: AlcanceAprobacion;
  /** Empleado que pidió. */
  solicitanteId: string;
  /** Empleado vinculado a quien intenta resolver, o null si no tiene ficha. */
  aprobadorId: string | null;
  relaciones: readonly RelacionMando[];
  /**
   * Empleados que podrían resolver de hecho: con cuenta de usuario activa y
   * permiso. Decide si el respaldo de RR. HH. entra en juego.
   */
  aprobadoresPosibles: ReadonlySet<string>;
};

/**
 * Veredicto de la regla jerárquica. `null` = puede resolver.
 *
 * El respaldo de RR. HH. es la pieza que evita el bloqueo: si en la cadena del
 * solicitante no hay NADIE que pueda resolver de hecho, cualquiera con el
 * permiso puede hacerlo. Así, un organigrama incompleto —el caso normal
 * mientras se carga— nunca deja una solicitud sin salida, y la regla se
 * endurece sola a medida que el organigrama se completa.
 */
export function evaluarJerarquiaAprobacion(
  consulta: ConsultaJerarquia,
): MotivoRechazoJerarquia | null {
  const { alcance, solicitanteId, aprobadorId, relaciones, aprobadoresPosibles } = consulta;
  if (alcance === "SIN_JERARQUIA") return null;

  const cadena = cadenaDeMando(solicitanteId, relaciones);
  const habilitados =
    alcance === "JEFE_DIRECTO" ? cadena.slice(0, 1) : cadena;

  // Respaldo de RR. HH.: nadie de la cadena puede resolver de hecho.
  if (!habilitados.some((id) => aprobadoresPosibles.has(id))) return null;

  if (aprobadorId !== null && habilitados.includes(aprobadorId)) return null;
  return alcance === "JEFE_DIRECTO" ? "NO_ES_JEFE_DIRECTO" : "FUERA_DE_CADENA";
}

export const ETIQUETA_ALCANCE_APROBACION: Record<AlcanceAprobacion, string> = {
  SIN_JERARQUIA: "Sin jerarquía — basta el permiso",
  JEFE_DIRECTO: "Solo el jefe directo",
  CADENA_MANDO: "Cualquier superior de la cadena",
};

export const DESCRIPCION_ALCANCE_APROBACION: Record<AlcanceAprobacion, string> = {
  SIN_JERARQUIA:
    "Cualquiera con permiso de aprobación en RR. HH. resuelve, salvo el propio solicitante.",
  JEFE_DIRECTO:
    "Solo el jefe directo del solicitante. Si el solicitante no tiene jefe con cuenta activa, resuelve RR. HH.",
  CADENA_MANDO:
    "El jefe directo o cualquier superior por encima de él. Si nadie de esa cadena tiene cuenta activa, resuelve RR. HH.",
};
