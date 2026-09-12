// Partición de stock por zona dentro de un almacén.
//
// Diseño deliberado: es una capa ADITIVA sobre SaldoAlmacen. El kardex sigue
// moviendo el saldo del almacén sin conocer zonas — cambiarlo habría obligado
// a que cada entrada, salida y traslado del sistema eligiera zona, con el
// riesgo que eso implica sobre el módulo que más historia inmutable maneja.
//
// Lo que no se repartió queda como "sin zona", derivado y no almacenado:
//
//     saldoAlmacen = suma(saldoZona) + sinZona
//
// Así la suma siempre cuadra con el saldo del almacén, y desactivar la
// partición es volver a leer solo SaldoAlmacen sin perder ni migrar nada.

export type SaldoDeZona = {
  zonaAlmacenId: string;
  cantidad: number;
};

export type DistribucionZonas = {
  porZona: SaldoDeZona[];
  asignado: number;
  sinZona: number;
  total: number;
};

/**
 * Reparto de un ítem en un almacén. `sinZona` nunca es negativo: si los saldos
 * por zona superaran el saldo del almacén (dato inconsistente), se reporta 0 y
 * el descuadre queda visible comparando `asignado` contra `total`.
 */
export function distribucionZonas(
  saldoAlmacen: number,
  saldos: readonly SaldoDeZona[],
): DistribucionZonas {
  const porZona = saldos.filter((s) => s.cantidad !== 0);
  const asignado = porZona.reduce((acc, s) => acc + s.cantidad, 0);
  return {
    porZona,
    asignado,
    sinZona: Math.max(0, saldoAlmacen - asignado),
    total: saldoAlmacen,
  };
}

/** El reparto cuadra con el saldo del almacén. */
export function distribucionCuadra(distribucion: DistribucionZonas): boolean {
  return Math.abs(distribucion.asignado + distribucion.sinZona - distribucion.total) <= 1e-9;
}

export type MovimientoEntreZonas = {
  /** null = tomar del stock sin zona asignada. */
  zonaOrigenId: string | null;
  /**
   * null = dejarlo sin zona asignada.
   *
   * Es lo que hace el picking: sacar de la zona y llevarlo a la playa de
   * despacho, que no es una zona de almacenamiento. «Sin zona» ya valía como
   * origen; admitirlo también como destino cierra la simetría que faltaba.
   */
  zonaDestinoId: string | null;
  cantidad: number;
};

export type ErrorMovimientoZona =
  | "CANTIDAD_INVALIDA"
  | "MISMA_ZONA"
  | "SIN_SALDO_EN_ORIGEN"
  | "SIN_SALDO_SIN_ZONA";

/**
 * Valida un movimiento entre zonas contra la distribución actual. No escribe:
 * la acción decide qué hacer con el veredicto.
 *
 * Mover entre zonas NO cambia el saldo del almacén, así que no puede generar
 * ni destruir stock: solo se comprueba que el origen tenga lo que se saca.
 */
export function validarMovimientoEntreZonas(
  movimiento: MovimientoEntreZonas,
  distribucion: DistribucionZonas,
): ErrorMovimientoZona | null {
  const { zonaOrigenId, zonaDestinoId, cantidad } = movimiento;
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "CANTIDAD_INVALIDA";
  // Cubre también «sin zona» a «sin zona», que no mueve nada.
  if (zonaOrigenId === zonaDestinoId) return "MISMA_ZONA";

  if (zonaOrigenId === null) {
    return cantidad > distribucion.sinZona + 1e-9 ? "SIN_SALDO_SIN_ZONA" : null;
  }
  const origen = distribucion.porZona.find((s) => s.zonaAlmacenId === zonaOrigenId);
  const disponible = origen?.cantidad ?? 0;
  return cantidad > disponible + 1e-9 ? "SIN_SALDO_EN_ORIGEN" : null;
}

export const MENSAJE_ERROR_ZONA: Record<ErrorMovimientoZona, string> = {
  CANTIDAD_INVALIDA: "La cantidad a mover debe ser mayor a cero.",
  MISMA_ZONA: "La zona de origen y la de destino son la misma.",
  SIN_SALDO_EN_ORIGEN: "La zona de origen no tiene esa cantidad disponible.",
  SIN_SALDO_SIN_ZONA: "No hay esa cantidad de stock sin zona asignada en el almacén.",
};

/**
 * Zona principal: la de mayor cantidad. Reemplaza al puntero único
 * `Presentacion.zonaAlmacenId` / `Insumo.zonaAlmacenId` como vista derivada —
 * el puntero se conserva, pero deja de ser la verdad sobre dónde está el
 * stock. Empata por cantidad se resuelve por id, para que el resultado no
 * dependa del orden en que la base devolvió las filas.
 */
export function zonaPrincipal(saldos: readonly SaldoDeZona[]): string | null {
  const conStock = saldos.filter((s) => s.cantidad > 0);
  if (conStock.length === 0) return null;
  return conStock.reduce((mejor, actual) => {
    if (actual.cantidad > mejor.cantidad) return actual;
    if (actual.cantidad < mejor.cantidad) return mejor;
    return actual.zonaAlmacenId < mejor.zonaAlmacenId ? actual : mejor;
  }).zonaAlmacenId;
}
