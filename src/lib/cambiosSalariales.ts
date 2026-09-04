export function esCambioSalarialValido(sueldoAnterior: number, sueldoNuevo: number): boolean {
  return Number.isFinite(sueldoAnterior) && Number.isFinite(sueldoNuevo) && sueldoAnterior >= 0 && sueldoNuevo > 0 && sueldoAnterior !== sueldoNuevo;
}
