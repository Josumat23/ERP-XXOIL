// Tanques de granel: qué pasa con la trazabilidad cuando dos recepciones se
// mezclan físicamente.
//
// ---------------------------------------------------------------------------
// El problema
//
// La base lubricante llega en cisterna y se descarga en un tanque que casi
// siempre tiene remanente de la recepción anterior. Desde ese momento los dos
// lotes están **mezclados**: ningún kilo que salga de ahí se puede atribuir a
// una sola recepción. Es un hecho físico, no una limitación del sistema.
//
// Hasta hoy el sistema no tenía dónde representarlo. La trazabilidad iba
// `LoteGranel → AsignacionLoteInsumo → RecepcionCompraDetalle → lote del
// proveedor`, que es correcta mientras cada recepción se consuma entera desde
// su propio envase.
//
// ---------------------------------------------------------------------------
// Qué hacen los ERP grandes, y por qué está mal
//
// SAP mantiene los lotes como stocks separados dentro de la misma ubicación y
// al consumir **obliga a elegir uno**. El registro queda diciendo «esto salió
// del lote A» cuando físicamente salió de una mezcla. Eso es peor que no tener
// trazabilidad: es una respuesta equivocada con aire de certeza, y el día de un
// reclamo manda a revisar el lote que no era. Para modelarlo de verdad hace
// falta la gestión de silos de su solución de petróleo, que se vende aparte.
// Epicor directamente no lo modela.
//
// ---------------------------------------------------------------------------
// Qué hace esto
//
// Dice la verdad: el consumo se reparte **en proporción** a lo que cada
// recepción aporta al tanque en ese momento. Un consumo de 1.000 kg de un
// tanque con 60 % del lote A y 40 % del lote B genera dos asignaciones, de 600
// y 400 kg.
//
// La cadena de trazabilidad no cambia: el tanque es una etapa de mezcla que
// abre un consumo en varias `AsignacionLoteInsumo`. Las consultas de recall que
// ya existen siguen funcionando sin tocar una línea, y ahora además responden
// **con qué proporción** participó cada lote.

/** Lo que una recepción aporta hoy al contenido de un tanque. */
export type AporteTanque = {
  /** `RecepcionCompraDetalle.id`: el eslabón hacia el lote del proveedor. */
  recepcionCompraDetalleId: string;
  /** Cuánto QUEDA de ese aporte dentro del tanque. */
  cantidadKg: number;
};

export type RepartoConsumo = {
  recepcionCompraDetalleId: string;
  cantidadKg: number;
};

export type ErrorTanque =
  | "TANQUE_VACIO"
  | "CANTIDAD_INVALIDA"
  | "CONTENIDO_INSUFICIENTE"
  | "EXCEDE_CAPACIDAD";

export const MENSAJE_ERROR_TANQUE: Record<ErrorTanque, string> = {
  TANQUE_VACIO: "El tanque no tiene contenido: no hay de qué consumir.",
  CANTIDAD_INVALIDA: "La cantidad debe ser mayor que cero.",
  CONTENIDO_INSUFICIENTE:
    "El tanque no tiene esa cantidad. Un tanque no se sobregira: revise el contenido real antes de consumir.",
  EXCEDE_CAPACIDAD:
    "La descarga no entra en el tanque. Descargar de más no es un redondeo: es producto en el piso.",
};

/**
 * Los decimales con los que se reparte.
 *
 * Tres decimales de kilo es un gramo, que es más fino que cualquier balanza de
 * planta. Existe porque el reparto tiene que **sumar exacto**, y sin un punto
 * de corte declarado la suma de proporciones deja restos irracionales.
 */
export const DECIMALES_KG = 3;

const redondear = (n: number) => Math.round(n * 10 ** DECIMALES_KG) / 10 ** DECIMALES_KG;

export function contenidoTanque(aportes: readonly AporteTanque[]): number {
  return redondear(aportes.reduce((total, a) => total + a.cantidadKg, 0));
}

/**
 * Cómo se reparte un consumo entre las recepciones que componen el tanque.
 *
 * **La suma del reparto es exactamente la cantidad pedida.** No es un detalle
 * de presentación: cada kilo repartido descuenta de la disponibilidad de una
 * recepción, así que un reparto que suma de menos deja stock fantasma y uno que
 * suma de más sobregira un lote. El resto del redondeo se le asigna al aporte
 * más grande, que es el que mejor lo absorbe.
 */
export function repartirConsumo(
  aportes: readonly AporteTanque[],
  cantidadKg: number
): RepartoConsumo[] | ErrorTanque {
  if (!Number.isFinite(cantidadKg) || cantidadKg <= 0) return "CANTIDAD_INVALIDA";

  const conSaldo = aportes.filter((a) => a.cantidadKg > 0);
  if (conSaldo.length === 0) return "TANQUE_VACIO";

  const total = contenidoTanque(conSaldo);
  // La tolerancia es de medio gramo: por debajo de eso es ruido de redondeo,
  // no un sobregiro.
  if (cantidadKg > total + 10 ** -DECIMALES_KG / 2) return "CONTENIDO_INSUFICIENTE";

  const pedido = Math.min(cantidadKg, total);
  const reparto = conSaldo.map((a) => ({
    recepcionCompraDetalleId: a.recepcionCompraDetalleId,
    cantidadKg: redondear((a.cantidadKg / total) * pedido),
  }));

  // Ningún aporte puede quedar repartiendo más de lo que tiene por un redondeo
  // hacia arriba.
  for (let i = 0; i < reparto.length; i++) {
    reparto[i].cantidadKg = Math.min(reparto[i].cantidadKg, conSaldo[i].cantidadKg);
  }

  // Y la suma tiene que cerrar contra lo pedido. El resto va al aporte mayor
  // que pueda absorberlo sin pasarse.
  const suma = redondear(reparto.reduce((t, r) => t + r.cantidadKg, 0));
  let resto = redondear(pedido - suma);
  if (resto !== 0) {
    const orden = reparto
      .map((r, i) => ({ i, holgura: conSaldo[i].cantidadKg - r.cantidadKg, asignado: r.cantidadKg }))
      .sort((a, b) => (resto > 0 ? b.holgura - a.holgura : b.asignado - a.asignado));
    for (const { i } of orden) {
      if (resto === 0) break;
      const limite =
        resto > 0
          ? Math.min(resto, redondear(conSaldo[i].cantidadKg - reparto[i].cantidadKg))
          : Math.max(resto, -reparto[i].cantidadKg);
      reparto[i].cantidadKg = redondear(reparto[i].cantidadKg + limite);
      resto = redondear(resto - limite);
    }
  }

  // Un aporte que recibió cero por ser diminuto no genera asignación: una
  // asignación de 0 kg no dice nada y ensucia la trazabilidad.
  return reparto.filter((r) => r.cantidadKg > 0);
}

/** ¿Entra esta descarga en el tanque? */
export function cabeEnTanque(params: {
  contenidoActualKg: number;
  capacidadKg: number;
  descargaKg: number;
}): true | ErrorTanque {
  const { contenidoActualKg, capacidadKg, descargaKg } = params;
  if (!Number.isFinite(descargaKg) || descargaKg <= 0) return "CANTIDAD_INVALIDA";
  if (redondear(contenidoActualKg + descargaKg) > capacidadKg) return "EXCEDE_CAPACIDAD";
  return true;
}

/**
 * La composición del tanque, en porcentaje.
 *
 * Es lo que hace útil al modelo el día de un reclamo: no solo qué lotes
 * participaron sino **cuánto** de cada uno.
 */
export function composicionTanque(
  aportes: readonly AporteTanque[]
): { recepcionCompraDetalleId: string; cantidadKg: number; porcentaje: number }[] {
  const total = contenidoTanque(aportes);
  if (total <= 0) return [];
  return aportes
    .filter((a) => a.cantidadKg > 0)
    .map((a) => ({
      recepcionCompraDetalleId: a.recepcionCompraDetalleId,
      cantidadKg: a.cantidadKg,
      porcentaje: redondear((a.cantidadKg / total) * 100),
    }))
    .sort((a, b) => b.cantidadKg - a.cantidadKg);
}
