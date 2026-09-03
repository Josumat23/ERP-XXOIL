export type CaracteristicaPlanEntrada = {
  secuencia: number;
  nombre: string;
  unidadMedida: string;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  metodoEnsayo: string | null;
  obligatoria: boolean;
};

export type LecturaCalidad = { caracteristicaId: string; valorMedido: number };

export function normalizarCaracteristicasPlan(valor: string): CaracteristicaPlanEntrada[] {
  let filas: unknown;
  try { filas = JSON.parse(valor); } catch { throw new Error("Las características del plan no tienen un formato válido."); }
  if (!Array.isArray(filas) || filas.length === 0) throw new Error("Agregue al menos una característica de inspección.");
  return filas.map((fila, indice) => {
    if (!fila || typeof fila !== "object") throw new Error(`La característica ${indice + 1} no es válida.`);
    const dato = fila as Record<string, unknown>;
    const nombre = String(dato.nombre ?? "").trim();
    const unidadMedida = String(dato.unidadMedida ?? "").trim();
    const metodoEnsayo = String(dato.metodoEnsayo ?? "").trim() || null;
    const convertir = (v: unknown) => v === "" || v === null || v === undefined ? null : Number(v);
    const limiteInferior = convertir(dato.limiteInferior);
    const limiteSuperior = convertir(dato.limiteSuperior);
    if (!nombre || !unidadMedida) throw new Error(`Complete nombre y unidad en la característica ${indice + 1}.`);
    if (limiteInferior !== null && !Number.isFinite(limiteInferior)) throw new Error(`El límite inferior de ${nombre} no es válido.`);
    if (limiteSuperior !== null && !Number.isFinite(limiteSuperior)) throw new Error(`El límite superior de ${nombre} no es válido.`);
    if (limiteInferior === null && limiteSuperior === null) throw new Error(`${nombre} debe tener al menos un límite de especificación.`);
    if (limiteInferior !== null && limiteSuperior !== null && limiteInferior > limiteSuperior) throw new Error(`Los límites de ${nombre} están invertidos.`);
    return { secuencia: indice + 1, nombre, unidadMedida, limiteInferior, limiteSuperior, metodoEnsayo, obligatoria: dato.obligatoria !== false };
  });
}

export function normalizarLecturasCalidad(valor: string): LecturaCalidad[] {
  let filas: unknown;
  try { filas = JSON.parse(valor); } catch { throw new Error("Las mediciones no tienen un formato válido."); }
  if (!Array.isArray(filas)) throw new Error("Las mediciones no tienen un formato válido.");
  return filas.map((fila) => {
    if (!fila || typeof fila !== "object") throw new Error("Existe una medición inválida.");
    const dato = fila as Record<string, unknown>;
    const caracteristicaId = String(dato.caracteristicaId ?? "");
    const valorCrudo = dato.valorMedido;
    const valorMedido = Number(valorCrudo);
    if (!caracteristicaId || valorCrudo === "" || valorCrudo === null || valorCrudo === undefined || !Number.isFinite(valorMedido)) throw new Error("Complete todas las mediciones obligatorias con valores numéricos.");
    return { caracteristicaId, valorMedido };
  });
}

export function valorCumpleEspecificacion(valor: number, minimo: number | null, maximo: number | null) {
  return (minimo === null || valor >= minimo) && (maximo === null || valor <= maximo);
}
