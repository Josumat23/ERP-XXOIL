export type VisitaRutaNormalizada = {
  clienteId: string;
  objetivo: string;
};

export function normalizarVisitasRuta(valor: unknown): VisitaRutaNormalizada[] | null {
  if (!Array.isArray(valor)) return null;

  const visitas: VisitaRutaNormalizada[] = [];
  for (const candidata of valor) {
    if (
      typeof candidata !== "object" ||
      candidata === null ||
      !("clienteId" in candidata) ||
      !("objetivo" in candidata) ||
      typeof candidata.clienteId !== "string" ||
      typeof candidata.objetivo !== "string"
    ) {
      continue;
    }
    if (candidata.clienteId) {
      visitas.push({ clienteId: candidata.clienteId, objetivo: candidata.objetivo });
    }
  }

  return visitas;
}
