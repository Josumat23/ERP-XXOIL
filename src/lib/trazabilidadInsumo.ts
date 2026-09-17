import { resumenDespacho, type DestinoDeLote } from "./despachoLote";

// ---------------------------------------------------------------------------
// De un insumo recibido a los clientes que lo tienen.
//
// La ficha del lote ya contestaba la pregunta hacia atrás: «¿de qué recepciones
// salió este lote?». Faltaba la de ida, que es la que se hace el día que un
// proveedor avisa de un problema con su material, o el día que una inspección
// de entrada queda sin respaldo: «¿qué se fabricó con esto, y dónde está?».
//
// Sin ella la respuesta se arma lote por lote y a mano, que con volumen real
// significa que no se arma.
//
// Es una CONSULTA. No frena ni exige nada: el negocio fue explícito en que la
// trazabilidad relaciona, no bloquea.
// ---------------------------------------------------------------------------

/** Una asignación de material a un lote, con sus devoluciones. */
export type AsignacionConsumo = {
  cantidad: number;
  devoluciones: { cantidad: number }[];
};

/**
 * Lo que de verdad quedó consumido: lo asignado menos lo devuelto a almacén.
 *
 * La resta estaba escrita dentro de `devolverLoteInsumo` y hacía falta acá;
 * se extrajo en vez de copiarse. Una asignación devuelta por completo da cero
 * y no es un consumo — mostrarla sería acusar a un lote de llevar material que
 * volvió al estante.
 */
export function netoConsumido(asignacion: AsignacionConsumo): number {
  const devuelto = asignacion.devoluciones.reduce((total, d) => total + d.cantidad, 0);
  return asignacion.cantidad - devuelto;
}

export type ConsumoEnLote = {
  loteGranelId: string;
  loteCodigo: string;
  productoNombre: string;
  estadoLote: string;
  /** Cuánto de ESTA recepción entró en ese lote, neto de devoluciones. */
  cantidadConsumida: number;
  /** A dónde salió el producto de ese lote. Vacío = sigue en casa. */
  destinos: DestinoDeLote[];
};

/** Una fila del cruce asignación × lote, tal como llega de un join. */
export type FilaConsumo = {
  loteGranelId: string;
  loteCodigo: string;
  productoNombre: string;
  estadoLote: string;
  asignacion: AsignacionConsumo;
  destinos: DestinoDeLote[];
};

/**
 * Los lotes que consumieron el material, ordenados por lo que urge.
 *
 * Primero los que ya salieron al cliente: ahí el problema dejó de ser de
 * almacén. Entre iguales, el que más material llevó — es el más expuesto si
 * resulta que el material estaba mal.
 *
 * Un lote puede aparecer con varias asignaciones de la misma recepción (se
 * consumió en dos tandas); se suman en una sola fila, porque la pregunta es
 * cuánto de ese material lleva el lote.
 */
export function lotesQueConsumieron(filas: FilaConsumo[]): ConsumoEnLote[] {
  const porLote = new Map<string, ConsumoEnLote>();

  for (const fila of filas) {
    const neto = netoConsumido(fila.asignacion);
    if (neto <= 0) continue;
    const existente = porLote.get(fila.loteGranelId);
    if (existente) {
      existente.cantidadConsumida += neto;
      continue;
    }
    porLote.set(fila.loteGranelId, {
      loteGranelId: fila.loteGranelId,
      loteCodigo: fila.loteCodigo,
      productoNombre: fila.productoNombre,
      estadoLote: fila.estadoLote,
      cantidadConsumida: neto,
      destinos: fila.destinos,
    });
  }

  return [...porLote.values()].sort((a, b) => {
    const saliA = a.destinos.length > 0 ? 1 : 0;
    const saliB = b.destinos.length > 0 ? 1 : 0;
    return (
      saliB - saliA ||
      b.cantidadConsumida - a.cantidadConsumida ||
      a.loteCodigo.localeCompare(b.loteCodigo)
    );
  });
}

export type ResumenTrazabilidadInsumo = {
  lotes: number;
  cantidadConsumida: number;
  /** Lotes cuyo producto ya salió a algún cliente. */
  lotesDespachados: number;
  unidadesDespachadas: number;
  /** Clientes DISTINTOS en todos los lotes juntos. */
  clientesAfectados: number;
};

/**
 * El resumen de arriba de la pantalla.
 *
 * Los clientes se cuentan como conjunto y no sumando el conteo de cada lote:
 * un mismo cliente puede haber recibido producto de dos lotes distintos, y
 * sumarlos lo contaría dos veces — diciendo que el problema alcanza a más
 * gente de la que alcanza.
 */
export function resumenTrazabilidadInsumo(consumos: ConsumoEnLote[]): ResumenTrazabilidadInsumo {
  const clientes = new Set<string>();
  let unidades = 0;
  let despachados = 0;
  for (const c of consumos) {
    const resumen = resumenDespacho(c.destinos);
    unidades += resumen.unidades;
    if (resumen.unidades > 0) despachados += 1;
    for (const d of c.destinos) clientes.add(d.clienteNombre);
  }
  return {
    lotes: consumos.length,
    cantidadConsumida: consumos.reduce((total, c) => total + c.cantidadConsumida, 0),
    lotesDespachados: despachados,
    unidadesDespachadas: unidades,
    clientesAfectados: clientes.size,
  };
}
