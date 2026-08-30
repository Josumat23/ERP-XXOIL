export type EntregaFacturable = {
  guiaDetalleId: string;
  cantidadEntregada: number;
  cantidadFacturada: number;
  costoUnitario: number;
  fechaSalida: Date;
};

export function calcularSaldoDocumento(cantidadBase: number, cantidadesConsumidas: readonly number[]): number {
  return cantidadBase - cantidadesConsumidas.reduce((total, cantidad) => total + cantidad, 0);
}

export function asignarEntregasFifo(
  entregas: readonly EntregaFacturable[],
  cantidadSolicitada: number
): { asignaciones: Array<{ guiaDetalleId: string; cantidad: number }>; costoUnitario: number } {
  if (!Number.isInteger(cantidadSolicitada) || cantidadSolicitada <= 0) {
    throw new Error("La cantidad a asignar debe ser un entero mayor a cero.");
  }
  let restante = cantidadSolicitada;
  let costoAcumulado = 0;
  const asignaciones: Array<{ guiaDetalleId: string; cantidad: number }> = [];

  for (const entrega of [...entregas].sort((a, b) => a.fechaSalida.getTime() - b.fechaSalida.getTime())) {
    const disponible = entrega.cantidadEntregada - entrega.cantidadFacturada;
    if (disponible <= 0 || restante <= 0) continue;
    const cantidad = Math.min(restante, disponible);
    asignaciones.push({ guiaDetalleId: entrega.guiaDetalleId, cantidad });
    costoAcumulado += cantidad * entrega.costoUnitario;
    restante -= cantidad;
  }
  if (restante > 0) {
    throw new Error("El saldo entregado cambió mientras se facturaba. Actualice la página.");
  }
  return { asignaciones, costoUnitario: costoAcumulado / cantidadSolicitada };
}