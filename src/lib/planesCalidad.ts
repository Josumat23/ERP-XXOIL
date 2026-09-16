export type CaracteristicaPlanEntrada = {
  secuencia: number;
  nombre: string;
  unidadMedida: string;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  metodoEnsayo: string | null;
  obligatoria: boolean;
  esDensidad: boolean;
};

export type LecturaCalidad = { caracteristicaId: string; valorMedido: number };

// Unidades en que una densidad puede venir declarada. Las tres son
// numéricamente idénticas —1 g/cm³ = 1 g/mL = 1 kg/L exactamente—, así que
// aceptarlas no convierte nada: es la misma cifra con otro nombre. ASTM D4052
// reporta en g/cm³ y el sistema razona en kg/L.
//
// Lo que NO se acepta es una magnitud adimensional: la «densidad relativa»
// (specific gravity) es un cociente contra el agua, no kg por litro, y
// tomarla por densidad metería un error de ~0,1 % en cada litro declarado.
const UNIDADES_DE_DENSIDAD = ["kg/l", "g/cm3", "g/cm³", "g/ml"];

function esUnidadDeDensidad(unidad: string): boolean {
  return UNIDADES_DE_DENSIDAD.includes(unidad.toLowerCase().replace(/\s+/g, ""));
}

/**
 * El valor medido de la característica marcada como densidad, si el plan
 * declara una y el ensayo la registró. `null` significa «este plan no mide la
 * densidad», que es distinto de «midió cero».
 */
export function densidadMedida(
  caracteristicas: { id: string; esDensidad: boolean }[],
  lecturas: LecturaCalidad[]
): number | null {
  const marcada = caracteristicas.find((c) => c.esDensidad);
  if (!marcada) return null;
  const lectura = lecturas.find((l) => l.caracteristicaId === marcada.id);
  return lectura ? lectura.valorMedido : null;
}

export function normalizarCaracteristicasPlan(valor: string): CaracteristicaPlanEntrada[] {
  let filas: unknown;
  try { filas = JSON.parse(valor); } catch { throw new Error("Las características del plan no tienen un formato válido."); }
  if (!Array.isArray(filas) || filas.length === 0) throw new Error("Agregue al menos una característica de inspección.");
  const caracteristicas = filas.map((fila, indice) => {
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
    const esDensidad = dato.esDensidad === true;
    // Una densidad que no se mide siempre no sirve para envasar: el lote la
    // necesita para convertir a litros, y «a veces» deja lotes sin ella.
    if (esDensidad && dato.obligatoria === false) {
      throw new Error(`${nombre} alimenta la densidad del lote, así que no puede ser opcional.`);
    }
    if (esDensidad && !esUnidadDeDensidad(unidadMedida)) {
      throw new Error(
        `${nombre} alimenta la densidad del lote, así que su unidad debe ser kg/L (o g/cm³, que es la misma cifra). «${unidadMedida}» no lo es.`
      );
    }
    return { secuencia: indice + 1, nombre, unidadMedida, limiteInferior, limiteSuperior, metodoEnsayo, obligatoria: dato.obligatoria !== false, esDensidad };
  });

  // Dos densidades en un plan no se pueden resolver: no hay forma de decir
  // cuál gobierna la conversión del lote, y elegir la primera sería inventar
  // un criterio que nadie declaró.
  const densidades = caracteristicas.filter((c) => c.esDensidad);
  if (densidades.length > 1) {
    throw new Error(
      `Solo una característica puede alimentar la densidad del lote; están marcadas ${densidades.length}: ${densidades.map((c) => c.nombre).join(", ")}.`
    );
  }
  return caracteristicas;
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
