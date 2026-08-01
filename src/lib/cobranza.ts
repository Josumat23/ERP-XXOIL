// Gestión de cobranza (dunning): niveles de escalamiento según días
// vencidos de una factura. Umbrales fijos, no configurables — para una sola
// empresa no hace falta que sean parametrizables por código de empresa como
// en SAP.
export function nivelSugerido(diasVencidos: number): 1 | 2 | 3 {
  if (diasVencidos > 30) return 3;
  if (diasVencidos > 15) return 2;
  return 1;
}

export const ETIQUETA_NIVEL: Record<number, string> = {
  1: "Aviso amistoso",
  2: "Aviso formal",
  3: "Aviso final",
};

export function diasVencidos(fechaVencimiento: Date, hoy: Date = new Date()): number {
  const ms = hoy.getTime() - fechaVencimiento.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
