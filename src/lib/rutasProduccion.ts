export type OperacionRutaNormalizada = {
  centroTrabajoId: string;
  secuencia: number;
  nombre: string;
  preparacionHoras: number;
  maquinaHoras: number;
  manoObraHoras: number;
};

export function normalizarRutaProduccion(valor: unknown): OperacionRutaNormalizada[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const resultado: OperacionRutaNormalizada[] = [];
  for (let indice = 0; indice < valor.length; indice += 1) {
    const item = valor[indice];
    if (!item || typeof item !== "object") return null;
    const registro = item as Record<string, unknown>;
    const centroTrabajoId = String(registro.centroTrabajoId ?? "").trim();
    const nombre = String(registro.nombre ?? "").trim();
    const preparacionHoras = Number(registro.preparacionHoras);
    const maquinaHoras = Number(registro.maquinaHoras);
    const manoObraHoras = Number(registro.manoObraHoras);
    const tiempos = [preparacionHoras, maquinaHoras, manoObraHoras];
    if (!centroTrabajoId || !nombre || nombre.length > 120 || tiempos.some((n) => !Number.isFinite(n) || n < 0) || tiempos.every((n) => n === 0)) return null;
    resultado.push({ centroTrabajoId, secuencia: indice + 10, nombre, preparacionHoras, maquinaHoras, manoObraHoras });
  }
  return resultado;
}

export function puedeIniciarOperacion(estadosAnteriores: string[], estadoActual: string) {
  return estadoActual === "PENDIENTE" && estadosAnteriores.every((estado) => estado === "COMPLETADA");
}
