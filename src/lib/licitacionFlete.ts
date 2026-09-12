// Licitación de flete: comparar cotizaciones de transportistas para un tramo.
//
// Funciones puras, sin Prisma. Las reglas son las mismas del RFQ de compras y
// por las mismas razones: contratar flete es comprar un servicio, y que sea un
// camión y no un insumo no cambia el control que hace falta.

/** Dos, como en el RFQ: una sola cotización no es una comparación. */
export const OFERTAS_MINIMAS = 2;

/** Longitud mínima de la justificación, la misma que exige el RFQ. */
export const JUSTIFICACION_MINIMA = 12;

export type OfertaComparable = {
  id: string;
  transportistaId: string;
  monto: number;
  moneda: string;
  tipoCambio: number;
  diasTransito: number;
};

/**
 * Monto llevado a la moneda funcional, que es la única forma de comparar dos
 * ofertas en monedas distintas. Sin esto, una oferta en dólares parecería
 * siempre la más barata.
 */
export function montoComparable(oferta: OfertaComparable): number {
  return oferta.moneda === "PEN" ? oferta.monto : oferta.monto * oferta.tipoCambio;
}

/**
 * La oferta más barata, ya normalizada a moneda funcional.
 *
 * A igual monto gana la de menor tránsito: si dos cuestan lo mismo, la que
 * llega antes es mejor y no hay nada que decidir.
 */
export function ofertaMasBarata<T extends OfertaComparable>(ofertas: T[]): T | null {
  return ofertas.reduce<T | null>((mejor, actual) => {
    if (mejor === null) return actual;
    const a = montoComparable(actual);
    const b = montoComparable(mejor);
    if (a < b) return actual;
    if (a > b) return mejor;
    return actual.diasTransito < mejor.diasTransito ? actual : mejor;
  }, null);
}

export type RevisionAdjudicacion =
  | { puede: false; motivo: string }
  | { puede: true; esLaMasBarata: boolean; sobrecosto: number };

/**
 * Revisa si una adjudicación puede hacerse, y con qué advertencia.
 *
 * Los tres impedimentos son los del RFQ: estado abierto, dos ofertas como
 * mínimo, y que quien solicitó no sea quien adjudica.
 *
 * Lo que **no** impide: adjudicar una oferta que no es la más barata. Elegir
 * al más caro puede ser lo correcto —cumple plazo, tiene la unidad adecuada,
 * responde el teléfono— y el sistema no sabe nada de eso. Lo que hace es
 * **decirlo**, con el sobrecosto calculado, para que la justificación se
 * escriba sabiendo lo que se está justificando.
 */
export function revisarAdjudicacion(params: {
  estado: string;
  ofertas: OfertaComparable[];
  ofertaElegidaId: string;
  solicitanteId: string;
  adjudicadorId: string;
}): RevisionAdjudicacion {
  if (params.estado !== "ABIERTA") {
    return { puede: false, motivo: "Esta licitación ya no está abierta." };
  }
  if (params.ofertas.length < OFERTAS_MINIMAS) {
    return {
      puede: false,
      motivo: `Registre ofertas de al menos ${OFERTAS_MINIMAS} transportistas antes de adjudicar.`,
    };
  }
  const elegida = params.ofertas.find((o) => o.id === params.ofertaElegidaId);
  if (!elegida) {
    return { puede: false, motivo: "La oferta elegida no pertenece a esta licitación." };
  }
  if (params.solicitanteId === params.adjudicadorId) {
    return { puede: false, motivo: "Quien solicitó la licitación no puede adjudicarla." };
  }

  const barata = ofertaMasBarata(params.ofertas);
  const sobrecosto = barata ? montoComparable(elegida) - montoComparable(barata) : 0;
  return {
    puede: true,
    esLaMasBarata: sobrecosto <= 0,
    // Redondeo a dos decimales: es un importe que se muestra.
    sobrecosto: Math.round(Math.max(0, sobrecosto) * 100) / 100,
  };
}

export function validarJustificacion(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio.length < JUSTIFICACION_MINIMA) {
    return `La justificación de adjudicación debe tener al menos ${JUSTIFICACION_MINIMA} caracteres.`;
  }
  if (limpio.length > 1000) return "La justificación no puede superar 1000 caracteres.";
  return null;
}

export function validarLicitacion(datos: {
  titulo: string;
  origen: string;
  destino: string;
  pesoEstimadoKg: number;
}): string | null {
  if (!datos.titulo.trim()) return "El título es obligatorio.";
  if (!datos.origen.trim() || !datos.destino.trim()) {
    return "El origen y el destino del tramo son obligatorios.";
  }
  if (!Number.isFinite(datos.pesoEstimadoKg) || datos.pesoEstimadoKg <= 0) {
    return "El peso estimado debe ser mayor a 0.";
  }
  return null;
}

export function validarOferta(datos: {
  monto: number;
  diasTransito: number;
  moneda: string;
  tipoCambio: number;
}): string | null {
  if (!Number.isFinite(datos.monto) || datos.monto <= 0) {
    return "El monto de la oferta debe ser mayor a 0.";
  }
  if (!Number.isInteger(datos.diasTransito) || datos.diasTransito < 0) {
    return "Los días de tránsito deben ser un número entero de 0 o más.";
  }
  // Sin tipo de cambio, una oferta en dólares no se puede comparar con una en
  // soles, que es justamente para lo que sirve la licitación.
  if (datos.moneda !== "PEN" && (!Number.isFinite(datos.tipoCambio) || datos.tipoCambio <= 0)) {
    return "Una oferta en moneda extranjera necesita un tipo de cambio válido.";
  }
  return null;
}
