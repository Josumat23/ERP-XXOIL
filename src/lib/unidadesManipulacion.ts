// Unidades de manipulación: el pallet, la caja o la jaula como cosa con
// nombre.
//
// Funciones puras, sin Prisma.
//
// Es una TERCERA capa aditiva sobre el stock, con la misma forma que las dos
// que ya existían:
//
//     saldoAlmacen = suma(saldoZona) + sinZona
//     saldoZona    = suma(contenido de las HU de esa zona) + suelto
//
// Lo que hay sobre un pallet **ya está contado** en el saldo de su zona. Armar
// una HU no crea ni destruye stock: dice que esas unidades están apiladas en
// vez de sueltas en el rack.

export type ContenidoHu = {
  presentacionId: string;
  cantidad: number;
};

export type RepartoEnZona = {
  /** Lo que está sobre alguna HU de la zona. */
  enUnidades: number;
  /** Lo que está en la zona pero no sobre una HU. */
  suelto: number;
  total: number;
};

/**
 * Cómo se reparte un ítem dentro de una zona.
 *
 * `suelto` nunca es negativo: si el contenido de las HU superara el saldo de la
 * zona —dato inconsistente—, se reporta 0 y el descuadre queda visible
 * comparando `enUnidades` contra `total`. Mismo criterio que `distribucionZonas`.
 */
export function repartoEnZona(
  saldoZona: number,
  contenidos: readonly ContenidoHu[],
  presentacionId: string
): RepartoEnZona {
  const enUnidades = contenidos
    .filter((c) => c.presentacionId === presentacionId)
    .reduce((acc, c) => acc + c.cantidad, 0);
  return {
    enUnidades,
    suelto: Math.max(0, saldoZona - enUnidades),
    total: saldoZona,
  };
}

export type ErrorArmado = "CANTIDAD_INVALIDA" | "SIN_SUELTO" | "SIN_ZONA";

export const MENSAJE_ERROR_ARMADO: Record<ErrorArmado, string> = {
  CANTIDAD_INVALIDA: "La cantidad debe ser mayor a cero.",
  SIN_SUELTO: "La zona no tiene esa cantidad suelta: el resto ya está sobre otra unidad.",
  SIN_ZONA: "La unidad no está en ninguna zona, así que no hay de dónde tomar el stock.",
};

/**
 * Validar que se pueda subir una cantidad a una HU.
 *
 * Solo se toma de lo **suelto**: lo que ya está sobre otro pallet no se puede
 * subir a este sin bajarlo antes. Si se permitiera, el mismo stock quedaría
 * sobre dos unidades y la capa dejaría de cuadrar.
 */
export function validarArmado(
  enZona: boolean,
  reparto: RepartoEnZona,
  cantidad: number
): ErrorArmado | null {
  if (!enZona) return "SIN_ZONA";
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "CANTIDAD_INVALIDA";
  return cantidad > reparto.suelto + 1e-9 ? "SIN_SUELTO" : null;
}

export function validarCodigo(codigo: string): string | null {
  const limpio = codigo.trim();
  if (!limpio) return "El código de la unidad es obligatorio.";
  if (limpio.length > 40) return "El código no puede superar 40 caracteres.";
  return null;
}

export type LineaPendiente = {
  presentacionId: string;
  pendiente: number;
};

export type VeredictoPickHu =
  | { puede: false; motivo: string }
  | { puede: true; aplicar: ContenidoHu[] };

/**
 * Si una HU completa se puede usar para cubrir líneas de una oleada.
 *
 * Se exige que **todo** su contenido quepa en lo pendiente. Bajar un pallet que
 * trae de más obligaría a devolver el sobrante al rack en el mismo acto, y el
 * sistema no sabría a qué zona; y llevárselo sin documento es stock saliendo
 * del almacén sin respaldo. Para ese caso está el picking por cantidad, que ya
 * existe.
 */
export function puedePickearUnidad(
  contenidos: readonly ContenidoHu[],
  pendientes: readonly LineaPendiente[]
): VeredictoPickHu {
  if (contenidos.length === 0) {
    return { puede: false, motivo: "La unidad está vacía." };
  }
  const pendientePorItem = new Map(pendientes.map((p) => [p.presentacionId, p.pendiente]));

  for (const c of contenidos) {
    const pendiente = pendientePorItem.get(c.presentacionId);
    if (pendiente === undefined) {
      return {
        puede: false,
        motivo: "La unidad trae un ítem que esta oleada no pide. Prepárela por cantidad.",
      };
    }
    if (c.cantidad > pendiente + 1e-9) {
      return {
        puede: false,
        motivo: `La unidad trae más de lo pendiente de algún ítem (${c.cantidad} contra ${pendiente}). Prepárela por cantidad.`,
      };
    }
  }
  return { puede: true, aplicar: contenidos.map((c) => ({ ...c })) };
}

export const ETIQUETA_TIPO_HU: Record<string, string> = {
  PALLET: "Pallet",
  CAJA: "Caja",
  CONTENEDOR: "Contenedor",
  JAULA: "Jaula",
};

export const ETIQUETA_ESTADO_HU: Record<string, string> = {
  EN_ALMACEN: "En almacén",
  EN_PLAYA: "En playa de despacho",
  VACIA: "Vacía",
};
