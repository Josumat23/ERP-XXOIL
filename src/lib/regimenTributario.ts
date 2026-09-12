// Etiquetas del régimen tributario.
//
// Vive en su propio módulo, sin importar Prisma, porque lo consume un
// componente `"use client"`: una constante importada desde un módulo cliente
// hacia un Server Component (o al revés, arrastrando el cliente de base al
// bundle del navegador) es un defecto que ya apareció antes en este repo y
// que una prueba de la suite vigila.
//
// El régimen es **referencia informativa**: no gobierna ninguna tasa ni
// cálculo del sistema.
export const ETIQUETA_REGIMEN_TRIBUTARIO: Record<string, string> = {
  NRUS: "NRUS — Nuevo Régimen Único Simplificado",
  RER: "RER — Régimen Especial de Renta",
  RMT: "RMT — Régimen MYPE Tributario",
  GENERAL: "Régimen General",
};
