// Re-análisis: volver a ensayar un lote envasado para darle vigencia nueva.
//
// Funciones puras, sin Prisma.
//
// ---------------------------------------------------------------------------
// Por qué existe
//
// Un lubricante no se echa a perder al llegar su fecha. La vida útil de
// `Producto.vidaUtilMeses` es una estimación conservadora: llegado el
// vencimiento, el laboratorio vuelve a ensayar el lote y, si sigue en
// especificación, le da vigencia nueva.
//
// Sin esto el vencimiento es duro y obliga a castigar stock bueno — que es lo
// que hacen los ERP genéricos, donde la fecha de caducidad es un dato del lote
// y no el resultado de una decisión de calidad.
//
// ---------------------------------------------------------------------------
// No es cambiar una fecha
//
// Es un **evento con evidencia**: quién ensayó, contra qué plan y con qué
// resultado. Extender un vencimiento sin dejar rastro es exactamente lo que una
// auditoría de calidad busca — y es trivial de hacer si el sistema se limita a
// dejar editar el campo.

export type ErrorReanalisis =
  | "SIN_VENCIMIENTO"
  | "SIN_SALDO"
  | "RECHAZADO_NO_EXTIENDE"
  | "VENCIMIENTO_EN_EL_PASADO"
  | "SIN_CAMBIO";

export const MENSAJE_ERROR_REANALISIS: Record<ErrorReanalisis, string> = {
  SIN_VENCIMIENTO:
    "Este lote no tiene vencimiento, así que no hay vigencia que revisar. Si el producto debería vencer, cargue su vida útil en la ficha.",
  SIN_SALDO:
    "El lote no tiene unidades en stock: extender la vigencia de algo que ya salió no cambia nada.",
  RECHAZADO_NO_EXTIENDE:
    "Un ensayo con resultado RECHAZADO no puede extender la vigencia. Registre el rechazo y disponga del lote; el re-análisis queda igualmente asentado.",
  VENCIMIENTO_EN_EL_PASADO:
    "El vencimiento nuevo ya pasó: no deja el lote en condiciones de usarse.",
  SIN_CAMBIO: "El vencimiento nuevo es el mismo que el actual: no hay nada que registrar.",
};

export type DatosReanalisis = {
  /** Vencimiento vigente del envasado. `null` = el producto no vence. */
  vencimientoActual: Date | null;
  vencimientoNuevo: Date;
  resultado: "APROBADO" | "RECHAZADO";
  unidadesDisponibles: number;
  hoy?: Date;
};

const MS_DIA = 24 * 60 * 60 * 1000;
const mismoDia = (a: Date, b: Date) =>
  Math.floor(a.getTime() / MS_DIA) === Math.floor(b.getTime() / MS_DIA);

/**
 * ¿Se puede registrar este re-análisis?
 *
 * Devuelve `null` si sí. Las reglas son pocas a propósito: la decisión de si el
 * producto sigue sirviendo es del laboratorio, no del sistema. Lo que el
 * sistema sí impide es que el registro diga algo que no pasó.
 */
export function validarReanalisis(datos: DatosReanalisis): ErrorReanalisis | null {
  const { vencimientoActual, vencimientoNuevo, resultado, unidadesDisponibles } = datos;
  const hoy = datos.hoy ?? new Date();

  // Sin vencimiento no hay vigencia que revisar.
  if (vencimientoActual === null) return "SIN_VENCIMIENTO";

  // Extender la vigencia de un lote que ya salió entero no cambia nada, y
  // ensucia el historial con eventos sin efecto.
  if (unidadesDisponibles <= 0) return "SIN_SALDO";

  // LA regla. Un ensayo que no pasó no puede alargar la vida del lote: si
  // pudiera, el re-análisis sería una forma de blanquear stock vencido.
  //
  // Acortar sí se permite con RECHAZADO — de hecho es lo esperable: el
  // laboratorio lo encuentra fuera de especificación y lo deja vencido ya.
  if (resultado === "RECHAZADO" && vencimientoNuevo.getTime() > vencimientoActual.getTime()) {
    return "RECHAZADO_NO_EXTIENDE";
  }

  // Un vencimiento nuevo ya pasado no deja el lote en condiciones de usarse.
  // Solo se admite en un rechazo, donde vencerlo es precisamente la intención.
  if (resultado === "APROBADO" && vencimientoNuevo.getTime() < hoy.getTime() && !mismoDia(vencimientoNuevo, hoy)) {
    return "VENCIMIENTO_EN_EL_PASADO";
  }

  if (mismoDia(vencimientoNuevo, vencimientoActual)) return "SIN_CAMBIO";

  return null;
}

/**
 * ¿Cómo describir lo que hizo este re-análisis?
 *
 * Se usa en el historial de la ficha. Que diga «extendió» o «acortó» y cuántos
 * días importa: una lista de fechas obliga a restar mentalmente en cada fila.
 */
export function efectoReanalisis(anterior: Date, nuevo: Date): {
  sentido: "EXTENDIO" | "ACORTO";
  dias: number;
  texto: string;
} {
  const dias = Math.round((nuevo.getTime() - anterior.getTime()) / MS_DIA);
  const sentido = dias >= 0 ? "EXTENDIO" : "ACORTO";
  const absolutos = Math.abs(dias);
  return {
    sentido,
    dias: absolutos,
    texto: `${sentido === "EXTENDIO" ? "Extendió" : "Acortó"} ${absolutos} ${absolutos === 1 ? "día" : "días"}`,
  };
}

/**
 * Vencimiento propuesto al re-analizar: la vida útil del producto contada
 * desde hoy, que es la práctica habitual.
 *
 * Es una **sugerencia para el formulario**, no una regla: quien ensaya puede
 * dar la vigencia que corresponda. Un sistema que la impusiera estaría
 * decidiendo algo que es del laboratorio.
 */
export function vencimientoSugerido(vidaUtilMeses: number | null, hoy: Date = new Date()): Date | null {
  if (vidaUtilMeses === null || vidaUtilMeses <= 0) return null;
  return new Date(hoy.getFullYear(), hoy.getMonth() + vidaUtilMeses, hoy.getDate());
}
