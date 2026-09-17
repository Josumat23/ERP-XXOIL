import type { Cobertura } from "@/lib/equivalencias";

// ---------------------------------------------------------------------------
// De la ficha de competencia al renglón de la cotización.
//
// Las equivalencias ya existen y se justifican contra especificaciones. Lo que
// faltaba es que sirvan en el momento en que hacen falta: el cliente pide un
// Delvac 1340 y el vendedor está cotizando.
//
// El salto no es trivial, y es donde una tabla de sinónimos se queda corta
// incluso teniendo la fila: la equivalencia apunta a un **producto**, pero se
// cotiza una **presentación**. Saber que la Grasa Chasis reemplaza al Delvac no
// dice qué SKU ofrecer, a qué precio, ni si hay con qué cumplir.
// ---------------------------------------------------------------------------

export type PresentacionSugerida = {
  presentacionId: string;
  sku: string;
  nombre: string;
  precio: number;
  moneda: string;
  /** Stock físico menos lo comprometido en pedidos: lo que se puede prometer. */
  disponible: number;
};

export type Sugerencia = {
  productoId: string;
  codigo: string;
  nombre: string;
  cobertura: Cobertura;
  justificacion: string | null;
  presentaciones: PresentacionSugerida[];
};

/**
 * Lo que se puede prometer: el stock físico sin lo ya comprometido en pedidos
 * pendientes. Ofrecer stock reservado es prometer dos veces la misma unidad.
 */
export function disponibleParaPrometer(presentacion: {
  stock: number;
  stockReservado: number;
}): number {
  return Math.max(0, presentacion.stock - presentacion.stockReservado);
}

/**
 * Ordena las sugerencias como las busca quien vende: primero lo que más cubre,
 * y entre iguales, lo que se puede entregar.
 *
 * Es una conveniencia de pantalla, no una regla de negocio: **no se esconde
 * nada**. Una cobertura parcial se muestra igual, con lo que le falta a la
 * vista, y un producto sin stock también — decir «no tenemos» es peor que
 * decir «lo tenemos, sin stock hoy», y ocultarlo llevaría a ofrecer al
 * competidor lo que sí se fabrica.
 */
export function ordenarSugerencias(sugerencias: Sugerencia[]): Sugerencia[] {
  const razon = (s: Sugerencia) =>
    s.cobertura.total === 0 ? 0 : s.cobertura.cubiertas.length / s.cobertura.total;
  const stock = (s: Sugerencia) =>
    s.presentaciones.reduce((total, p) => total + p.disponible, 0);

  return [...sugerencias].sort((a, b) => {
    const porCobertura = razon(b) - razon(a);
    if (porCobertura !== 0) return porCobertura;
    const porStock = stock(b) - stock(a);
    if (porStock !== 0) return porStock;
    return a.codigo.localeCompare(b.codigo);
  });
}

/**
 * Qué decir de una sugerencia en una línea. La cobertura no se resume en un
 * «equivalente» a secas: quien cotiza tiene que poder repetirle al cliente
 * exactamente qué cubre y qué no.
 */
export function resumenCobertura(cobertura: Cobertura): string {
  if (cobertura.total === 0) return "sin especificaciones que comparar";
  return cobertura.esTotal
    ? `cubre las ${cobertura.total} que declara`
    : `cubre ${cobertura.cubiertas.length} de ${cobertura.total}`;
}
