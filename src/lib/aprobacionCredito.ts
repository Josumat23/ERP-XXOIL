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
 * 4. **El 0 dejó de ser «sin límite» el 2026-09-14.** Ahora es SIN CRÉDITO, y
 *    «sin tope» se expresa con `null` — un estado heredado que ninguna alta
 *    nueva produce. Antes, bajar a 0 era el mayor aumento de exposición
 *    posible y había que tratarlo como tal; hoy es lo contrario, la bajada más
 *    grande que existe.
 */
export function decidirCambioLimiteCredito(
  limiteAnterior: number | null,
  limiteNuevo: number,
  umbral: number | null
): DecisionLimiteCredito {
  if (umbral === null) return { requiereAprobacion: false, motivo: "CONTROL_APAGADO" };

  // Ponerle un techo a quien no tenía ninguno reduce la exposición.
  if (limiteAnterior === null) return { requiereAprobacion: false, motivo: "NO_AUMENTA" };

  if (limiteNuevo <= limiteAnterior) return { requiereAprobacion: false, motivo: "NO_AUMENTA" };
  if (limiteNuevo <= umbral) return { requiereAprobacion: false, motivo: "BAJO_UMBRAL" };
  return { requiereAprobacion: true };
}

/**
 * Lo mismo, para un cliente que todavía no existe.
 *
 * No se puede expresar como un cambio, porque no hay límite anterior. Un alta
 * con un límite por encima del umbral se rechaza en vez de quedar pendiente:
 * dejar el cliente creado con un límite provisional obligaría a inventar el
 * número, y crear la solicitud aplicando el límite pedido sería exactamente el
 * control que se quiere evitar.
 *
 * **El 0 dejó de requerir aprobación el 2026-09-14.** Antes se leía como «sin
 * límite» y bloqueaba el alta, así que con el control encendido el vendedor no
 * podía crear un cliente con el valor seguro: estaba obligado a escribir algún
 * número positivo. Ahora 0 es SIN CRÉDITO — el estado con el que debe nacer
 * todo cliente— y por lo tanto nunca necesita que nadie lo apruebe.
 */
export function creacionRequiereAprobacion(limiteNuevo: number, umbral: number | null): boolean {
  if (umbral === null) return false;
  return limiteNuevo > umbral;
}

export const MENSAJE_LIMITE_PENDIENTE =
  "El aumento del límite quedó pendiente de aprobación en la bandeja de Gerencia. El cliente conserva su límite actual hasta que se resuelva.";
