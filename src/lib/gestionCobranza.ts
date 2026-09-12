// Seguimiento de un aviso de cobranza: qué pasó DESPUÉS de emitirlo.
//
// Funciones puras, sin Prisma, para que el componente cliente tome los tipos de
// aquí y la suite pruebe la lógica sin levantar la base.

export type EstadoRegistrado =
  | "PENDIENTE"
  | "COMPROMISO_PAGO"
  | "EN_DISPUTA"
  | "SIN_RESPUESTA";

/**
 * Lo que se muestra en pantalla: el estado registrado, más `COMPROMISO_INCUMPLIDO`,
 * que **se deriva** y por eso nunca se guarda.
 *
 * Un compromiso vencido con la factura todavía impaga deja de serlo en cuanto
 * el cliente paga, y se convierte en incumplimiento solo por el paso de un día.
 * Guardarlo sería garantizar que se quede viejo: cambia solo, sin que nadie
 * toque el aviso.
 */
export type SituacionAviso = EstadoRegistrado | "COMPROMISO_INCUMPLIDO";

export const ETIQUETA_ESTADO_AVISO: Record<SituacionAviso, string> = {
  PENDIENTE: "Sin respuesta aún",
  COMPROMISO_PAGO: "Compromiso de pago",
  COMPROMISO_INCUMPLIDO: "Compromiso incumplido",
  EN_DISPUTA: "En disputa",
  SIN_RESPUESTA: "No contestó",
};

export type AvisoSeguimiento = {
  estado: EstadoRegistrado;
  compromisoPagoEn: Date | null;
};

function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Se llama con avisos de facturas que siguen debiendo: la pantalla de cobranza
 * descarta las saldadas antes de llegar aquí. Por eso no hay una situación
 * "cobrada" — sería una rama que ningún dato puede alcanzar.
 */
export function situacionDelAviso(
  aviso: AvisoSeguimiento,
  hoy: Date = new Date()
): SituacionAviso {
  if (aviso.estado === "COMPROMISO_PAGO" && aviso.compromisoPagoEn) {
    // Se compara por día, no por instante: alguien que se comprometió para hoy
    // tiene todo el día para pagar. Marcarlo incumplido a las nueve de la
    // mañana sería una acusación falsa, y nadie confía en una bandeja que
    // acusa de más.
    const incumplido = inicioDelDia(aviso.compromisoPagoEn) < inicioDelDia(hoy);
    if (incumplido) return "COMPROMISO_INCUMPLIDO";
  }
  return aviso.estado;
}

/** Los estados que una persona puede registrar; los derivados no están. */
export const ESTADOS_REGISTRABLES: EstadoRegistrado[] = [
  "PENDIENTE",
  "COMPROMISO_PAGO",
  "EN_DISPUTA",
  "SIN_RESPUESTA",
];

/**
 * Valida la respuesta antes de guardarla. Devuelve el error o `null`.
 *
 * Un compromiso sin fecha no es un compromiso: no se puede hacer seguimiento de
 * algo que no dice cuándo. Y una disputa sin detalle no le sirve a quien tenga
 * que resolverla después.
 */
export function validarRespuesta(
  estado: string,
  compromisoPagoEn: Date | null,
  detalle: string
): string | null {
  if (!ESTADOS_REGISTRABLES.includes(estado as EstadoRegistrado)) {
    return "Seleccione qué contestó el cliente.";
  }
  if (estado === "COMPROMISO_PAGO") {
    if (!compromisoPagoEn) return "Un compromiso de pago necesita la fecha comprometida.";
  }
  if (estado === "EN_DISPUTA" && !detalle) {
    return "Indique qué objeta el cliente: es lo que va a revisar quien resuelva la disputa.";
  }
  if (detalle.length > 500) return "El detalle no puede superar 500 caracteres.";
  return null;
}
