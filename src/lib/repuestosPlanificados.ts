// Presupuesto de repuestos de un plan de mantenimiento preventivo.
//
// Funciones puras: reciben los datos ya leídos y no tocan la base.

export type RepuestoPlanificado = {
  insumoId: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
};

export type CostoPlanificado = {
  lineas: Array<RepuestoPlanificado & { subtotal: number }>;
  porEjecucion: number;
};

/**
 * Costo de UNA ejecución del plan, al costo promedio vigente de cada repuesto.
 *
 * Es una estimación, no un compromiso: el costo del insumo cambia con cada
 * compra, y lo que se consuma de verdad lo decide el operario al cerrar la
 * orden. Se redondea a 2 decimales por línea para que la suma en pantalla
 * coincida con lo que se ve, sin arrastrar centésimas invisibles.
 */
export function costoPlanificado(repuestos: readonly RepuestoPlanificado[]): CostoPlanificado {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const lineas = repuestos.map((r) => ({ ...r, subtotal: r2(r.cantidad * r.costoUnitario) }));
  return { lineas, porEjecucion: r2(lineas.reduce((acc, l) => acc + l.subtotal, 0)) };
}

/**
 * Cuántas veces corre un plan por tiempo en un año, para proyectar su costo
 * anual. Devuelve `null` cuando no se puede saber:
 *
 * - los planes **por contador** dependen de cuánto se use el equipo, y
 *   suponer un uso sería inventar un dato del negocio;
 * - una frecuencia de cero o negativa es dato inválido, no "corre infinitas
 *   veces".
 *
 * Quien lo muestre debe decir "no estimable", no cero: un cero se lee como
 * "no cuesta nada", que es justo lo contrario.
 */
export function ejecucionesPorAnio(
  tipo: "POR_TIEMPO" | "POR_CONTADOR",
  frecuenciaDias: number | null
): number | null {
  if (tipo !== "POR_TIEMPO") return null;
  if (frecuenciaDias === null || frecuenciaDias <= 0) return null;
  return Math.round((365 / frecuenciaDias) * 100) / 100;
}

/** Costo anual proyectado, o `null` si las ejecuciones no son estimables. */
export function costoAnualPlanificado(
  porEjecucion: number,
  ejecuciones: number | null
): number | null {
  if (ejecuciones === null) return null;
  return Math.round(porEjecucion * ejecuciones * 100) / 100;
}
