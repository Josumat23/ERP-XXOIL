export function puedeLiberarOrden(estado: string): boolean {
  return estado === "PLANIFICADO";
}

export function puedeEjecutarOrden(estado: string): boolean {
  return estado === "EN_PROCESO";
}
