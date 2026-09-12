// Picking por oleadas: preparar varias guías en una sola recorrida.
//
// Funciones puras, sin Prisma.
//
// El picking NO mueve el kardex. La salida de inventario la hace la guía
// cuando el camión sale; descontar también al preparar cobraría el stock dos
// veces. Lo que el picking mueve es la **capa de zonas**: saca el ítem de su
// zona y lo deja «sin zona», que es exactamente donde está mientras espera en
// la playa de despacho. Así `suma(zonas) + sinZona = saldoAlmacén` sigue
// siendo cierto en todo momento.

export type GuiaCandidata = {
  id: string;
  numero: string;
  estadoDespacho: string;
  /** `null` cuando la guía no nace de un pedido: traslado no comercial. */
  almacenId: string | null;
  requiereEntrega: boolean;
  /** Oleada abierta que ya la reclamó, si la hay. */
  oleadaAbiertaId: string | null;
};

export type MotivoNoElegible =
  | "YA_DESPACHADA"
  | "SIN_ALMACEN"
  | "SIN_ENTREGA"
  | "YA_EN_OLEADA";

export const MENSAJE_NO_ELEGIBLE: Record<MotivoNoElegible, string> = {
  YA_DESPACHADA: "La guía ya salió: no hay nada que preparar.",
  SIN_ALMACEN: "La guía no tiene almacén de origen, así que no se sabe de dónde tomar el stock.",
  SIN_ENTREGA: "El pedido no requiere entrega: la guía no mueve inventario.",
  YA_EN_OLEADA: "La guía ya está en otra oleada abierta.",
};

/**
 * Por qué una guía no puede entrar a una oleada, o `null` si puede.
 *
 * Las cuatro razones salen de lo que el picking necesita para existir: algo
 * pendiente de salir, un lugar de dónde sacarlo, inventario que mover, y que
 * nadie más lo esté preparando en paralelo.
 */
export function motivoNoElegible(guia: GuiaCandidata): MotivoNoElegible | null {
  if (guia.estadoDespacho !== "PLANIFICADO") return "YA_DESPACHADA";
  if (!guia.requiereEntrega) return "SIN_ENTREGA";
  if (!guia.almacenId) return "SIN_ALMACEN";
  if (guia.oleadaAbiertaId) return "YA_EN_OLEADA";
  return null;
}

export function esElegible(guia: GuiaCandidata): boolean {
  return motivoNoElegible(guia) === null;
}

export type LineaDeGuia = { presentacionId: string; cantidad: number };

/**
 * Consolida las líneas de todas las guías de la oleada en una por
 * presentación.
 *
 * Quien camina quiere saber cuántas unidades llevarse de un ítem, no repetir
 * el mismo pasillo una vez por documento. El reparto entre guías lo hace el
 * despacho, que ya sabe qué línea pertenece a cuál.
 *
 * Orden estable por presentación para que dos armados de la misma oleada
 * produzcan la misma lista.
 */
export function consolidarLineas(guias: readonly LineaDeGuia[][]): LineaDeGuia[] {
  const total = new Map<string, number>();
  for (const guia of guias) {
    for (const linea of guia) {
      total.set(linea.presentacionId, (total.get(linea.presentacionId) ?? 0) + linea.cantidad);
    }
  }
  return [...total.entries()]
    .map(([presentacionId, cantidad]) => ({ presentacionId, cantidad }))
    .sort((a, b) => a.presentacionId.localeCompare(b.presentacionId));
}

export type SugerenciaZona = {
  zonaAlmacenId: string | null;
  codigo: string;
  disponible: number;
};

/**
 * De dónde tomar un ítem, en el orden en que conviene recorrerlo.
 *
 * Primero las zonas con stock, ordenadas por su código —que es como están
 * rotuladas y, en un almacén con slotting, como están dispuestas—, y al final
 * lo que está «sin zona», porque es lo que hay que salir a buscar.
 *
 * No se elige una zona por el usuario: se le muestran las opciones con lo que
 * hay en cada una. El sistema no sabe cuál está más cerca de la puerta ni cuál
 * tiene la mercadería más vieja.
 */
export function sugerenciasDeZona(
  porZona: readonly { zonaAlmacenId: string; codigo: string; cantidad: number }[],
  sinZona: number
): SugerenciaZona[] {
  const zonas: SugerenciaZona[] = porZona
    .filter((z) => z.cantidad > 0)
    .map((z) => ({ zonaAlmacenId: z.zonaAlmacenId, codigo: z.codigo, disponible: z.cantidad }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (sinZona > 0) {
    zonas.push({ zonaAlmacenId: null, codigo: "Sin zona", disponible: sinZona });
  }
  return zonas;
}

export type AvanceOleada = {
  requerido: number;
  pickeado: number;
  faltante: number;
  completa: boolean;
};

export function avanceDeOleada(
  lineas: readonly { cantidadRequerida: number; cantidadPickeada: number }[]
): AvanceOleada {
  const requerido = lineas.reduce((t, l) => t + l.cantidadRequerida, 0);
  const pickeado = lineas.reduce((t, l) => t + l.cantidadPickeada, 0);
  const faltante = Math.max(0, requerido - pickeado);
  return { requerido, pickeado, faltante, completa: faltante <= 1e-9 };
}

/**
 * Cuánto más se puede pickear de una línea.
 *
 * Nunca más de lo pedido: pickear de más no es un sobrante que alguien vaya a
 * notar en el momento, es stock que sale del almacén sin documento que lo
 * respalde.
 */
export function validarPick(
  linea: { cantidadRequerida: number; cantidadPickeada: number },
  cantidad: number,
  disponibleEnOrigen: number
): string | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "La cantidad debe ser mayor a 0.";
  const pendiente = linea.cantidadRequerida - linea.cantidadPickeada;
  if (cantidad > pendiente + 1e-9) {
    return `Solo quedan ${pendiente} unidades por preparar de este ítem.`;
  }
  if (cantidad > disponibleEnOrigen + 1e-9) {
    return "El origen elegido no tiene esa cantidad disponible.";
  }
  return null;
}
