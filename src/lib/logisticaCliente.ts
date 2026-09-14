// Logística del cliente: cuándo, cómo y desde dónde se le entrega.
//
// Funciones puras, sin Prisma.
//
// La ventana horaria, los días de recepción y las restricciones son
// propiedades **del lugar**, no del cliente: una misma minera recibe en su
// planta de martes a jueves de 8 a 12 con inducción de seguridad, y en su
// almacén de puerto todos los días sin restricción.

export type FrecuenciaReparto = "SEMANAL" | "QUINCENAL" | "MENSUAL" | "A_PEDIDO";

export const ETIQUETA_FRECUENCIA: Record<FrecuenciaReparto, string> = {
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
  A_PEDIDO: "A pedido",
};

/** Lunes = 1 … Domingo = 7, como ISO. `Date.getDay()` usa domingo = 0. */
export const DIAS_SEMANA = [
  { numero: 1, campo: "recibeLunes", etiqueta: "Lun" },
  { numero: 2, campo: "recibeMartes", etiqueta: "Mar" },
  { numero: 3, campo: "recibeMiercoles", etiqueta: "Mié" },
  { numero: 4, campo: "recibeJueves", etiqueta: "Jue" },
  { numero: 5, campo: "recibeViernes", etiqueta: "Vie" },
  { numero: 6, campo: "recibeSabado", etiqueta: "Sáb" },
  { numero: 7, campo: "recibeDomingo", etiqueta: "Dom" },
] as const;

export type CampoDia = (typeof DIAS_SEMANA)[number]["campo"];

export type DiasRecepcion = Record<CampoDia, boolean>;

/** El día ISO (1..7) de una fecha. `getDay()` devuelve 0 para domingo. */
export function diaIso(fecha: Date): number {
  const dia = fecha.getDay();
  return dia === 0 ? 7 : dia;
}

export type ErrorVentana =
  | "HORA_FUERA_DE_RANGO"
  | "VENTANA_INCOMPLETA"
  | "VENTANA_VACIA"
  | "SIN_DIAS";

export const MENSAJE_ERROR_VENTANA: Record<ErrorVentana, string> = {
  HORA_FUERA_DE_RANGO: "La hora debe estar entre 00:00 y 23:59.",
  VENTANA_INCOMPLETA:
    "Indique las dos horas de la ventana de recepción, o ninguna si recibe a cualquier hora.",
  VENTANA_VACIA:
    "La hora de inicio y la de fin no pueden ser la misma: no se sabría si la ventana dura un instante o el día entero.",
  SIN_DIAS: "Marque al menos un día de recepción: si no, nunca se le podría entregar.",
};

export function validarVentana(params: {
  inicio: number | null;
  fin: number | null;
  dias: DiasRecepcion;
}): ErrorVentana | null {
  const { inicio, fin } = params;

  for (const hora of [inicio, fin]) {
    if (hora === null) continue;
    if (!Number.isInteger(hora) || hora < 0 || hora > 1439) return "HORA_FUERA_DE_RANGO";
  }

  // Media ventana no dice nada: «recibe desde las 8» sin hora de cierre no
  // permite decidir si un camión llega a tiempo.
  if ((inicio === null) !== (fin === null)) return "VENTANA_INCOMPLETA";

  // Iguales es ambiguo: ¿cero minutos o veinticuatro horas? Se pide que lo
  // diga quien carga, en vez de elegir por él.
  if (inicio !== null && fin !== null && inicio === fin) return "VENTANA_VACIA";

  if (!DIAS_SEMANA.some((d) => params.dias[d.campo])) return "SIN_DIAS";

  return null;
}

/**
 * ¿Ese momento cae dentro de la ventana de recepción?
 *
 * Sin ventana declarada, cualquier hora sirve. Con `fin < inicio` la ventana
 * cruza medianoche —el turno noche de una mina— y el rango es la unión de
 * `[inicio, 24h)` y `[0, fin)`.
 */
export function dentroDeVentana(
  momentoMin: number,
  ventana: { inicio: number | null; fin: number | null }
): boolean {
  if (ventana.inicio === null || ventana.fin === null) return true;
  if (ventana.inicio < ventana.fin) {
    return momentoMin >= ventana.inicio && momentoMin < ventana.fin;
  }
  return momentoMin >= ventana.inicio || momentoMin < ventana.fin;
}

/** ¿Se puede entregar ahí ese día? */
export function recibeEseDia(dias: DiasRecepcion, fecha: Date): boolean {
  const iso = diaIso(fecha);
  const dia = DIAS_SEMANA.find((d) => d.numero === iso);
  return dia ? dias[dia.campo] : false;
}

export function minutosAHora(minutos: number | null): string {
  if (minutos === null) return "";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `"08:30"` → 510. Devuelve `null` para vacío y `NaN` para lo que no es hora. */
export function horaAMinutos(texto: string): number | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(limpio);
  if (!m) return NaN;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return NaN;
  return horas * 60 + minutos;
}

/** Resumen legible de los días, agrupando el caso «todos». */
export function resumenDias(dias: DiasRecepcion): string {
  const activos = DIAS_SEMANA.filter((d) => dias[d.campo]);
  if (activos.length === 0) return "Ningún día";
  if (activos.length === 7) return "Todos los días";
  return activos.map((d) => d.etiqueta).join(", ");
}

// ---------------------------------------------------------------------------
// Cascos retornables
//
// El esquema decía, junto a `Insumo.esRetornable`: «el control de cascos
// pendientes por cliente es manual por ahora». Esto lo deja de ser.
//
// El saldo NO se guarda en el maestro: se calcula desde los movimientos, que
// es lo que el negocio pidió expresamente para saldos, facturas y pagos. Un
// número guardado se desincroniza; uno calculado no puede.
// ---------------------------------------------------------------------------

export type MovimientoCascoResumible = {
  insumoId: string;
  tipo: string;
  cantidad: number;
};

export type SaldoCasco = { insumoId: string; pendientes: number };

/**
 * Cascos que el cliente tiene en su poder, por tipo de envase.
 *
 * ENTREGADO suma y DEVUELTO resta. Un saldo negativo se conserva tal cual en
 * vez de recortarse a cero: significa que se registraron más devoluciones que
 * entregas, y eso es un error de carga que hay que ver, no esconder.
 */
export function saldoCascos(movimientos: readonly MovimientoCascoResumible[]): SaldoCasco[] {
  const porInsumo = new Map<string, number>();
  for (const m of movimientos) {
    const signo = m.tipo === "ENTREGADO" ? 1 : m.tipo === "DEVUELTO" ? -1 : 0;
    if (signo === 0) continue;
    porInsumo.set(m.insumoId, (porInsumo.get(m.insumoId) ?? 0) + signo * m.cantidad);
  }
  return [...porInsumo.entries()]
    .map(([insumoId, pendientes]) => ({ insumoId, pendientes }))
    .filter((s) => s.pendientes !== 0)
    .sort((a, b) => b.pendientes - a.pendientes);
}

/** Depósito comprometido por los cascos que el cliente todavía no devolvió. */
export function depositoComprometido(
  saldos: readonly SaldoCasco[],
  depositoPorInsumo: Readonly<Record<string, number>>
): number {
  return saldos.reduce(
    (total, s) => total + Math.max(0, s.pendientes) * (depositoPorInsumo[s.insumoId] ?? 0),
    0
  );
}
