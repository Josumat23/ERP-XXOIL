// Condiciones comerciales del cliente.
//
// Funciones puras, sin Prisma.

export type PrioridadAtencion = "ALTA" | "NORMAL" | "BAJA";

export const ETIQUETA_PRIORIDAD: Record<PrioridadAtencion, string> = {
  ALTA: "Atención prioritaria",
  NORMAL: "Normal",
  BAJA: "Baja",
};

/** Menor número, primero en la cola. */
export const ORDEN_PRIORIDAD: Record<PrioridadAtencion, number> = {
  ALTA: 0,
  NORMAL: 1,
  BAJA: 2,
};

/**
 * Qué descuento corresponde aplicar.
 *
 * **El del cliente reemplaza al del canal; no se suman.** Lo más específico
 * manda, que es la regla que cualquiera espera — y la única que no obliga a
 * inventar cómo se componen dos porcentajes: 15% y 10% podrían ser 25% o
 * 23.5% según quién lo mire, y elegir por el negocio sería inventarle una
 * política de precios.
 *
 * Un descuento de cliente en **0 es una decisión**, no un hueco: significa
 * «a este no le corresponde el descuento del canal». Por eso el estado
 * «sin descuento propio» se expresa con `null` y no con cero.
 */
export function descuentoAplicable(
  descuentoClientePct: number | null,
  descuentoCanalPct: number
): { pct: number; origen: "CLIENTE" | "CANAL" } {
  if (descuentoClientePct !== null) return { pct: descuentoClientePct, origen: "CLIENTE" };
  return { pct: descuentoCanalPct, origen: "CANAL" };
}

export type ErrorCondiciones =
  | "DESCUENTO_INVALIDO"
  | "DESCUENTO_EXCESIVO"
  | "PEDIDO_MINIMO_INVALIDO"
  | "MONEDA_INVALIDA";

export const MENSAJE_ERROR_CONDICIONES: Record<ErrorCondiciones, string> = {
  DESCUENTO_INVALIDO: "El descuento debe ser un porcentaje entre 0 y 100.",
  DESCUENTO_EXCESIVO:
    "Un descuento de 100% regala la mercadería. Si es una muestra o una reposición, corresponde registrarla como tal y no como una venta con descuento total.",
  PEDIDO_MINIMO_INVALIDO: "El pedido mínimo no puede ser negativo.",
  MONEDA_INVALIDA: "La moneda habitual debe ser PEN o USD.",
};

export const MONEDAS_VALIDAS = ["PEN", "USD"] as const;

export function validarCondiciones(params: {
  descuentoGeneralPct: number | null;
  pedidoMinimo: number | null;
  monedaDefecto: string;
}): ErrorCondiciones | null {
  const pct = params.descuentoGeneralPct;
  if (pct !== null) {
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "DESCUENTO_INVALIDO";
    if (pct === 100) return "DESCUENTO_EXCESIVO";
  }

  const minimo = params.pedidoMinimo;
  if (minimo !== null && (!Number.isFinite(minimo) || minimo < 0)) {
    return "PEDIDO_MINIMO_INVALIDO";
  }

  if (!MONEDAS_VALIDAS.includes(params.monedaDefecto as (typeof MONEDAS_VALIDAS)[number])) {
    return "MONEDA_INVALIDA";
  }

  return null;
}

/**
 * ¿El pedido alcanza el mínimo del cliente?
 *
 * Se compara contra el total **en la moneda del pedido**, que es la misma en
 * la que se declaró el mínimo: convertir acá haría que el mínimo cambiara con
 * el tipo de cambio del día, que no es lo que nadie acuerda con un cliente.
 */
export function alcanzaPedidoMinimo(total: number, minimo: number | null): boolean {
  if (minimo === null) return true;
  return total + 1e-9 >= minimo;
}

/**
 * Qué falta para poder tomar el pedido.
 *
 * Devuelve el motivo, no un booleano: quien recibe el rechazo necesita saber
 * cuál de las dos condiciones incumplió.
 */
export type IncumplimientoComercial =
  | { tipo: "PEDIDO_MINIMO"; minimo: number; total: number }
  | { tipo: "FALTA_ORDEN_COMPRA" };

export function revisarCondicionesPedido(params: {
  total: number;
  pedidoMinimo: number | null;
  requiereOrdenCompra: boolean;
  ordenCompraCliente: string | null;
}): IncumplimientoComercial | null {
  if (params.requiereOrdenCompra && !params.ordenCompraCliente?.trim()) {
    return { tipo: "FALTA_ORDEN_COMPRA" };
  }
  if (!alcanzaPedidoMinimo(params.total, params.pedidoMinimo)) {
    return {
      tipo: "PEDIDO_MINIMO",
      minimo: params.pedidoMinimo!,
      total: params.total,
    };
  }
  return null;
}

export function mensajeIncumplimiento(
  incumplimiento: IncumplimientoComercial,
  moneda: string
): string {
  if (incumplimiento.tipo === "FALTA_ORDEN_COMPRA") {
    return "Este cliente exige su número de orden de compra para aceptar pedidos. Sin ella, el despacho vuelve rechazado desde su almacén.";
  }
  const { minimo, total } = incumplimiento;
  return `El pedido suma ${moneda} ${total.toFixed(2)} y el mínimo acordado con este cliente es ${moneda} ${minimo.toFixed(2)}.`;
}
