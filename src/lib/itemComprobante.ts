// El ítem de un comprobante electrónico, con una cantidad que significa lo que
// su unidad dice.
//
// Vive acá y no en un `actions.ts` porque lo usan **tres** salidas —factura,
// nota de crédito y guía de remisión— y las tres lo estaban resolviendo por su
// cuenta con la misma línea:
//
//     unidadMedida: presentacion.unidadMedidaSunat,   // p. ej. "LTR"
//     cantidad:     detalle.cantidad,                  // 10  ← unidades
//
// Un balde de 20 L configurado como `LTR` declaraba «10 LTR» por 10 baldes, o
// sea 200 litros. El número y su unidad se contradecían en un documento fiscal,
// y nada lo validaba. Que el defecto estuviera en los tres lugares a la vez es
// exactamente lo que pasa cuando la regla se repite en vez de compartirse.
import {
  cantidadDeclaradaDePresentacion,
  MENSAJE_ERROR_DENSIDAD,
  type PresentacionParaComprobante,
} from "@/lib/densidad";

/** Lo mínimo que hace falta saber de una presentación para declararla. */
export type PresentacionDeclarable = {
  nombre: string;
  unidadMedidaSunat: string;
  contenidoKg: { toNumber: () => number };
  contenidoLitros: { toNumber: () => number } | null;
  producto: {
    densidadKgL: { toNumber: () => number } | null;
    temperaturaReferenciaC: { toNumber: () => number } | null;
  };
};

export type ItemComprobante = {
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  valorUnitario: number;
};

/**
 * Arma el ítem, o **detiene el envío**.
 *
 * Si falta el dato para convertir no se declara una cantidad aproximada:
 * emitir una cifra inventada ante SUNAT es peor que no emitir, porque el
 * comprobante queda mal y hay que anularlo con una nota de crédito.
 */
export function itemComprobante(
  presentacion: PresentacionDeclarable,
  unidades: number,
  valorUnitario: number
): ItemComprobante {
  const datos: PresentacionParaComprobante = {
    unidadMedidaSunat: presentacion.unidadMedidaSunat,
    contenidoKg: presentacion.contenidoKg.toNumber(),
    contenidoLitros: presentacion.contenidoLitros?.toNumber() ?? null,
    producto: {
      densidadKgL: presentacion.producto.densidadKgL?.toNumber() ?? null,
      temperaturaReferenciaC: presentacion.producto.temperaturaReferenciaC?.toNumber() ?? null,
    },
  };

  const resultado = cantidadDeclaradaDePresentacion(datos, unidades);
  if ("error" in resultado) {
    throw new Error(
      `No se puede declarar «${presentacion.nombre}» en ${presentacion.unidadMedidaSunat}: ` +
        (resultado.error === "FALTA_CONTENIDO"
          ? "la presentación no tiene contenido cargado."
          : MENSAJE_ERROR_DENSIDAD[resultado.error])
    );
  }

  return {
    descripcion: presentacion.nombre,
    unidadMedida: resultado.unidad,
    cantidad: resultado.cantidad,
    valorUnitario,
  };
}
