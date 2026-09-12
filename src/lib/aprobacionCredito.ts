// Cuándo un cambio de límite de crédito necesita aprobación.
//
// Funciones puras: reciben los números y no tocan la base.

export type DecisionLimiteCredito =
  /** Se aplica directo: el control está apagado, o no aumenta la exposición. */
  | { requiereAprobacion: false; motivo: "CONTROL_APAGADO" | "NO_AUMENTA" | "BAJO_UMBRAL" }
  /** Queda pendiente: el límite no cambia hasta que alguien lo apruebe. */
  | { requiereAprobacion: true };

/**
 * Decide si un cambio de límite pasa por aprobación.
 *
 * Tres reglas, en este orden:
 *
 * 1. **Umbral nulo, control apagado.** El límite se edita directo, que es como
 *    venía funcionando. Encenderlo es una decisión de política de crédito, y el
 *    sistema no elige una por su cuenta.
 *
 * 2. **Solo los aumentos.** Bajar un límite reduce la exposición; pedir
 *    aprobación para bajarlo solo lograría que nadie los baje. Mantenerlo igual
 *    tampoco es un cambio.
 *
 * 3. **El umbral mira el límite RESULTANTE, no cuánto subió.** La exposición es
 *    el límite que queda: un cliente con 200 000 son 200 000 de riesgo venga de
 *    donde venga. Es el mismo criterio que ya usa el umbral de compras, que
 *    mira el total de la orden y no su variación.
 *
 * Cuidado con el límite 0: en este sistema significa **sin límite**, no
 *    "no puede comprar". Por eso pasar de 5 000 a 0 se trata como el aumento de
 *    exposición que realmente es, y no como una bajada a cero.
 */
export function decidirCambioLimiteCredito(
  limiteAnterior: number,
  limiteNuevo: number,
  umbral: number | null
): DecisionLimiteCredito {
  if (umbral === null) return { requiereAprobacion: false, motivo: "CONTROL_APAGADO" };

  const anteriorEsIlimitado = limiteAnterior === 0;
  const nuevoEsIlimitado = limiteNuevo === 0;

  // Quitar el límite es la mayor exposición posible: siempre pasa por
  // aprobación, salvo que ya fuera ilimitado.
  if (nuevoEsIlimitado) {
    return anteriorEsIlimitado
      ? { requiereAprobacion: false, motivo: "NO_AUMENTA" }
      : { requiereAprobacion: true };
  }
  // Ponerle un límite a quien no tenía ninguno reduce la exposición.
  if (anteriorEsIlimitado) return { requiereAprobacion: false, motivo: "NO_AUMENTA" };

  if (limiteNuevo <= limiteAnterior) return { requiereAprobacion: false, motivo: "NO_AUMENTA" };
  if (limiteNuevo <= umbral) return { requiereAprobacion: false, motivo: "BAJO_UMBRAL" };
  return { requiereAprobacion: true };
}

/**
 * Lo mismo, para un cliente que todavía no existe.
 *
 * No se puede expresar como un cambio, porque no hay límite anterior: un
 * cliente nuevo no tiene crédito, y eso no es lo mismo que tener 0 (que aquí
 * significa *sin límite*). Un alta con un límite por encima del umbral se
 * rechaza en vez de quedar pendiente: dejar el cliente creado con un límite
 * provisional obligaría a inventar el número, y crear la solicitud aplicando
 * el límite pedido sería exactamente el control que se quiere evitar.
 */
export function creacionRequiereAprobacion(limiteNuevo: number, umbral: number | null): boolean {
  if (umbral === null) return false;
  if (limiteNuevo === 0) return true; // sin límite
  return limiteNuevo > umbral;
}

export const MENSAJE_LIMITE_PENDIENTE =
  "El aumento del límite quedó pendiente de aprobación en la bandeja de Gerencia. El cliente conserva su límite actual hasta que se resuelva.";
