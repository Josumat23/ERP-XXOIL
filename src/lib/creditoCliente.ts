// Perfil de crédito del cliente.
//
// Funciones puras, sin Prisma.
//
// Lo que se guarda es lo que una persona decide; lo que se calcula sale de los
// movimientos. El negocio lo pidió expresamente: saldos, facturas y pagos no
// se duplican en el maestro.

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

export const ETIQUETA_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  BAJO: "Riesgo bajo",
  MEDIO: "Riesgo medio",
  ALTO: "Riesgo alto",
};

/**
 * Estado de crédito.
 *
 * **Se deriva, no se guarda.** Una tercera columna de bloqueo que hay que
 * mantener en sintonía con `bloqueadoCobranza` y con la bandera de aprobación
 * es justamente cómo tres banderas terminan contradiciéndose. El orden importa:
 * un cliente bloqueado por deuda no está «sujeto a aprobación», está frenado.
 */
export type EstadoCredito = "HABILITADO" | "SUJETO_A_APROBACION" | "BLOQUEADO";

export const ETIQUETA_ESTADO_CREDITO: Record<EstadoCredito, string> = {
  HABILITADO: "Crédito habilitado",
  SUJETO_A_APROBACION: "Sujeto a aprobación",
  BLOQUEADO: "Crédito bloqueado",
};

export function estadoCredito(cliente: {
  bloqueadoCobranza: boolean;
  requiereAprobacionCredito: boolean;
}): EstadoCredito {
  if (cliente.bloqueadoCobranza) return "BLOQUEADO";
  if (cliente.requiereAprobacionCredito) return "SUJETO_A_APROBACION";
  return "HABILITADO";
}

export type ErrorPerfilCredito =
  | "RIESGO_ALTO_SIN_MOTIVO"
  | "MOTIVO_LARGO"
  | "TOLERANCIA_INVALIDA"
  | "TOLERANCIA_EXCESIVA";

export const MENSAJE_ERROR_PERFIL_CREDITO: Record<ErrorPerfilCredito, string> = {
  RIESGO_ALTO_SIN_MOTIVO:
    "Clasificar a un cliente como riesgo alto necesita el motivo: es lo que va a leer quien decida venderle igual.",
  MOTIVO_LARGO: "El motivo no puede superar 500 caracteres.",
  TOLERANCIA_INVALIDA: "La tolerancia de vencimiento debe ser un número entero de días, sin decimales ni negativos.",
  TOLERANCIA_EXCESIVA:
    "Una tolerancia mayor a 90 días desactiva la cobranza en la práctica. Si es lo que se quiere, corresponde revisar la condición de pago, no la tolerancia.",
};

export function validarPerfilCredito(params: {
  nivelRiesgo: string | null;
  motivoNivelRiesgo: string;
  toleranciaVencimientoDias: number | null;
}): ErrorPerfilCredito | null {
  const motivo = params.motivoNivelRiesgo.trim();

  // Clasificar como riesgo alto restringe a alguien: esa decisión tiene que
  // poder releerse. Bajo y medio no necesitan explicación.
  if (params.nivelRiesgo === "ALTO" && !motivo) return "RIESGO_ALTO_SIN_MOTIVO";
  if (motivo.length > 500) return "MOTIVO_LARGO";

  const tolerancia = params.toleranciaVencimientoDias;
  if (tolerancia !== null) {
    if (!Number.isInteger(tolerancia) || tolerancia < 0) return "TOLERANCIA_INVALIDA";
    if (tolerancia > 90) return "TOLERANCIA_EXCESIVA";
  }

  return null;
}

/**
 * Días vencidos descontando la gracia de este cliente.
 *
 * La tolerancia **corre** la política de escalamiento de la compañía; no la
 * reemplaza ni la apaga. `null` significa que rige la política tal cual.
 */
export function diasVencidosConTolerancia(
  diasVencidos: number,
  toleranciaDias: number | null
): number {
  return Math.max(0, diasVencidos - (toleranciaDias ?? 0));
}

/**
 * Cupo que le queda.
 *
 * `null` cuando el cliente no tiene tope —el estado heredado— porque
 * «disponible» no significa nada sin techo, y devolver Infinity o un número
 * grande invitaría a compararlo.
 */
export function creditoDisponible(limite: number | null, deuda: number): number | null {
  if (limite === null) return null;
  return limite - deuda;
}

export type FacturaHistorica = {
  fechaVencimiento: Date;
  /** Fecha en que quedó cancelada; `null` si sigue pendiente. */
  canceladaEn: Date | null;
};

export type ComportamientoPago = {
  cerradas: number;
  pagadasTarde: number;
  diasAtrasoPromedio: number;
  diasAtrasoMaximo: number;
};

/**
 * Cómo paga este cliente, según lo que efectivamente pasó.
 *
 * No es un puntaje ni una clasificación: es el historial, para que quien
 * clasifique el riesgo lo haga mirando hechos. Inventar una fórmula que
 * tradujera esto a BAJO/MEDIO/ALTO sería inventar una política de crédito que
 * nadie definió.
 *
 * Solo cuenta facturas **cerradas**: una pendiente todavía no dice si se pagó
 * tarde, y meterla como «0 días de atraso» mejoraría el promedio de quien
 * simplemente no ha pagado.
 */
export function comportamientoPago(facturas: readonly FacturaHistorica[]): ComportamientoPago {
  const cerradas = facturas.filter((f) => f.canceladaEn !== null);
  if (cerradas.length === 0) {
    return { cerradas: 0, pagadasTarde: 0, diasAtrasoPromedio: 0, diasAtrasoMaximo: 0 };
  }

  const MS_DIA = 24 * 60 * 60 * 1000;
  const atrasos = cerradas.map((f) =>
    Math.max(0, Math.floor((f.canceladaEn!.getTime() - f.fechaVencimiento.getTime()) / MS_DIA))
  );
  const tarde = atrasos.filter((d) => d > 0);
  const suma = atrasos.reduce((a, b) => a + b, 0);

  return {
    cerradas: cerradas.length,
    pagadasTarde: tarde.length,
    // Promedio sobre TODAS las cerradas, no solo sobre las tardías: el
    // promedio de las tardías diría "paga 20 días tarde" de quien pagó
    // puntual 19 de 20 veces.
    diasAtrasoPromedio: Math.round((suma / cerradas.length) * 10) / 10,
    diasAtrasoMaximo: atrasos.reduce((a, b) => Math.max(a, b), 0),
  };
}
