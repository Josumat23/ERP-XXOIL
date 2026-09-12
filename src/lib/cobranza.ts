// Gestión de cobranza (dunning): etiquetas de nivel y antigüedad de una
// factura vencida.
//
// El nivel por antigüedad vive en `escalamientoCobranza.ts`, porque desde que
// los umbrales son configurables depende de la política de la compañía. Aquí
// había una copia con 15 y 30 fijos; se quitó al quedar sin uso.
export const ETIQUETA_NIVEL: Record<number, string> = {
  1: "Aviso amistoso",
  2: "Aviso formal",
  3: "Aviso final",
};

export function diasVencidos(fechaVencimiento: Date, hoy: Date = new Date()): number {
  const ms = hoy.getTime() - fechaVencimiento.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
