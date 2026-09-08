export type MovimientoValorizable = {
  almacenId: string;
  itemId: string;
  tipoItem: "INSUMO" | "PRESENTACION";
  saldoNuevo: number;
  costoUnitario: number;
};

export function construirValorizacionInventario(movimientosDescendentes: MovimientoValorizable[]) {
  const vistos = new Set<string>();
  const filas: Array<MovimientoValorizable & { valor: number; costoDisponible: boolean }> = [];
  for (const movimiento of movimientosDescendentes) {
    const clave = `${movimiento.almacenId}:${movimiento.tipoItem}:${movimiento.itemId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const costoDisponible = Number.isFinite(movimiento.costoUnitario) && movimiento.costoUnitario > 0;
    filas.push({ ...movimiento, valor: costoDisponible ? movimiento.saldoNuevo * movimiento.costoUnitario : 0, costoDisponible });
  }
  return { filas, valorTotal: filas.reduce((suma, fila) => suma + fila.valor, 0), filasSinCosto: filas.filter((fila) => fila.saldoNuevo !== 0 && !fila.costoDisponible).length };
}
