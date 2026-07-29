// Ley peruana: 30 días calendario de vacaciones por año completo de labor,
// acumulados proporcionalmente al tiempo trabajado. Cálculo de referencia
// simple — no contempla récord truncado, doble/triple remuneración ni la
// mecánica exacta de planillas; solo para mostrar un saldo orientativo.
export function diasAcumulados(fechaIngreso: Date, fechaCorte: Date = new Date()): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  const diasTrabajados = Math.max(0, (fechaCorte.getTime() - fechaIngreso.getTime()) / msPorDia);
  return (diasTrabajados / 365) * 30;
}

export function saldoVacaciones(
  fechaIngreso: Date,
  diasYaAprobados: number,
  fechaCorte: Date = new Date()
): number {
  return diasAcumulados(fechaIngreso, fechaCorte) - diasYaAprobados;
}
