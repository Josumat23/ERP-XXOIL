// Convertir entre masa y volumen: el problema central de una planta de
// lubricantes.
//
// El granel se produce, se controla y se cuesta en **kilogramos**. El producto
// se vende y se declara a SUNAT en **litros o galones**. El puente entre los
// dos es la densidad, y la densidad no es una constante del sistema: es una
// propiedad del producto que además varía de lote en lote y con la temperatura.
//
// ---------------------------------------------------------------------------
// Por qué no alcanza con un factor de conversión
//
// Es como lo resuelven los ERP grandes. SAP guarda un factor fijo por material
// (tabla MARM: 1 L = X kg) y Epicor hace lo mismo con sus factores de UOM. El
// número es un dato maestro constante, así que cuando la densidad real del lote
// difiere de la que alguien cargó, la conversión sale mal **en silencio**. SAP
// lo reconoce al punto de vender IS-Oil como complemento aparte solo para
// agregar conversión con densidad y temperatura: el núcleo se equivoca y el
// arreglo se cobra.
//
// Acá la densidad se guarda como lo que es —una medición, con su temperatura de
// referencia— y toda conversión **dice qué densidad usó**. Un número que no se
// puede auditar hasta su origen no sirve para un comprobante fiscal.
//
// ---------------------------------------------------------------------------
// Qué NO hace este módulo
//
// No corrige por temperatura. La corrección volumétrica del petróleo (ASTM
// D1250 / tablas API) necesita el coeficiente de expansión del producto, que no
// está en el sistema y que nadie pidió. Lo que sí hace es **no dejar comparar
// densidades tomadas a temperaturas distintas**, que es el error que produciría
// un número creíble y equivocado.

/** Densidad utilizable, con su procedencia. La procedencia es parte del dato. */
export type Densidad = {
  kgPorLitro: number;
  temperaturaC: number | null;
  /** De dónde salió: importa para poder auditar una cantidad declarada. */
  origen: "LOTE_MEDIDO" | "ESPECIFICACION_PRODUCTO";
};

export type ErrorDensidad =
  | "SIN_DENSIDAD"
  | "DENSIDAD_INVALIDA"
  | "TEMPERATURAS_DISTINTAS";

export const MENSAJE_ERROR_DENSIDAD: Record<ErrorDensidad, string> = {
  SIN_DENSIDAD:
    "El producto no tiene densidad cargada, así que no se puede convertir entre kilogramos y litros. " +
    "Cárguela en la ficha del producto (kg/L y a qué temperatura se midió).",
  DENSIDAD_INVALIDA:
    "La densidad tiene que ser mayor que cero. Un lubricante ronda 0,85–0,95 kg/L.",
  TEMPERATURAS_DISTINTAS:
    "La densidad medida del lote y la de especificación están tomadas a temperaturas distintas: " +
    "no son comparables sin corrección volumétrica, que este sistema no hace.",
};

/**
 * Rango de cordura para un lubricante o grasa.
 *
 * No es una regla legal ni una especificación: es un cerco contra el error de
 * tipeo. Las bases y los terminados de este rubro caen entre 0,80 y 1,05 kg/L;
 * un 8,7 —la coma en el lugar equivocado— produciría un volumen diez veces
 * menor y una factura equivocada. Se avisa, no se prohíbe: quien tenga un
 * producto fuera de rango puede guardarlo igual.
 */
export const DENSIDAD_TIPICA_MIN = 0.8;
export const DENSIDAD_TIPICA_MAX = 1.05;

export function densidadFueraDeRangoTipico(kgPorLitro: number): boolean {
  return kgPorLitro < DENSIDAD_TIPICA_MIN || kgPorLitro > DENSIDAD_TIPICA_MAX;
}

/**
 * Qué densidad corresponde usar.
 *
 * La del lote manda sobre la del producto: la especificación dice a qué se
 * apunta y la medición dice qué salió, y lo que se envasó es lo que salió.
 */
export function densidadAplicable(params: {
  densidadLoteKgL?: number | null;
  densidadProductoKgL?: number | null;
  temperaturaReferenciaC?: number | null;
}): Densidad | ErrorDensidad {
  const { densidadLoteKgL, densidadProductoKgL, temperaturaReferenciaC } = params;

  const elegida = densidadLoteKgL ?? densidadProductoKgL ?? null;
  if (elegida === null) return "SIN_DENSIDAD";
  if (!Number.isFinite(elegida) || elegida <= 0) return "DENSIDAD_INVALIDA";

  return {
    kgPorLitro: elegida,
    temperaturaC: temperaturaReferenciaC ?? null,
    origen: densidadLoteKgL != null ? "LOTE_MEDIDO" : "ESPECIFICACION_PRODUCTO",
  };
}

/** Kilogramos a litros. Devuelve también con qué se convirtió. */
export function kgALitros(
  kg: number,
  densidad: Densidad
): { litros: number; densidad: Densidad } {
  return { litros: kg / densidad.kgPorLitro, densidad };
}

/** Litros a kilogramos. */
export function litrosAKg(
  litros: number,
  densidad: Densidad
): { kg: number; densidad: Densidad } {
  return { kg: litros * densidad.kgPorLitro, densidad };
}

/** Un galón estadounidense, que es el que usa el código GLL del Catálogo 03. */
export const LITROS_POR_GALON = 3.785411784;

export function litrosAGalones(litros: number): number {
  return litros / LITROS_POR_GALON;
}

/**
 * ¿El contenido en litros declarado para una presentación es coherente con su
 * contenido en kilogramos y la densidad del producto?
 *
 * `contenidoLitros` se carga a mano y hasta hoy no se comparaba con nada — un
 * balde de 20 kg de un producto de 0,88 kg/L son 22,7 L, y si alguien escribe
 * 20 el error viaja hasta la factura.
 *
 * La tolerancia existe porque el contenido nominal de un envase es un número
 * comercial redondeado, no el resultado de una división.
 */
export const TOLERANCIA_CONTENIDO = 0.02; // 2 %

export function contenidoLitrosCoherente(params: {
  contenidoKg: number;
  contenidoLitros: number;
  densidad: Densidad;
  tolerancia?: number;
}): { coherente: boolean; litrosEsperados: number; desvio: number } {
  const { contenidoKg, contenidoLitros, densidad, tolerancia = TOLERANCIA_CONTENIDO } = params;
  const litrosEsperados = contenidoKg / densidad.kgPorLitro;
  const desvio = Math.abs(contenidoLitros - litrosEsperados) / litrosEsperados;
  return { coherente: desvio <= tolerancia, litrosEsperados, desvio };
}

// ---------------------------------------------------------------------------
// La cantidad que se declara en un comprobante
//
// Este es el defecto que motivó el módulo. La factura se armaba así:
//
//     unidadMedida: presentacion.unidadMedidaSunat   // p. ej. "LTR"
//     cantidad:     detalle.cantidad                  // 10  ← unidades
//
// Un balde de 20 L configurado como `LTR` declaraba «10 LTR» cuando son 200
// litros. El número y su unidad se contradecían, y nada lo validaba.
//
// Qué código corresponde a un producto envasado es una pregunta tributaria y no
// se responde acá. Lo que sí es responsabilidad del sistema es que **la cifra
// signifique lo que su unidad dice**.
// ---------------------------------------------------------------------------

/** Códigos del Catálogo 03 que cuentan CONTENIDO y no envases. */
export const UNIDADES_DE_CONTENIDO = ["LTR", "GLL", "KGM"] as const;
export type UnidadContenido = (typeof UNIDADES_DE_CONTENIDO)[number];

export function esUnidadDeContenido(codigo: string): codigo is UnidadContenido {
  return (UNIDADES_DE_CONTENIDO as readonly string[]).includes(codigo);
}

export type CantidadDeclarada =
  | { cantidad: number; unidad: string; densidadUsada: Densidad | null }
  | { error: ErrorDensidad | "FALTA_CONTENIDO" };

/**
 * La cantidad a declarar para una línea, coherente con su unidad.
 *
 * - `NIU` y demás: se declaran las unidades, como siempre.
 * - `KGM`: unidades × contenido en kilogramos. No necesita densidad.
 * - `LTR` / `GLL`: unidades × contenido en volumen. Se usa el contenido en
 *   litros si está cargado; si no, se deriva del peso con la densidad.
 */
export function cantidadDeclarada(params: {
  unidadMedidaSunat: string;
  unidades: number;
  contenidoKg?: number | null;
  contenidoLitros?: number | null;
  densidad?: Densidad | null;
}): CantidadDeclarada {
  const { unidadMedidaSunat, unidades, contenidoKg, contenidoLitros, densidad } = params;

  if (!esUnidadDeContenido(unidadMedidaSunat)) {
    return { cantidad: unidades, unidad: unidadMedidaSunat, densidadUsada: null };
  }

  if (unidadMedidaSunat === "KGM") {
    if (contenidoKg == null) return { error: "FALTA_CONTENIDO" };
    return { cantidad: unidades * contenidoKg, unidad: "KGM", densidadUsada: null };
  }

  // LTR o GLL: hace falta el volumen del envase.
  let litrosPorEnvase = contenidoLitros ?? null;
  let densidadUsada: Densidad | null = null;
  if (litrosPorEnvase == null) {
    if (contenidoKg == null) return { error: "FALTA_CONTENIDO" };
    if (!densidad) return { error: "SIN_DENSIDAD" };
    litrosPorEnvase = contenidoKg / densidad.kgPorLitro;
    densidadUsada = densidad;
  }

  const litros = unidades * litrosPorEnvase;
  return unidadMedidaSunat === "GLL"
    ? { cantidad: litrosAGalones(litros), unidad: "GLL", densidadUsada }
    : { cantidad: litros, unidad: "LTR", densidadUsada };
}

/**
 * Lo mismo, a partir de una presentación y su producto.
 *
 * Existe para que las tres salidas de comprobante —factura, nota de crédito y
 * guía de remisión— declaren con la MISMA regla. Estaban las tres escribiendo
 * `cantidad: d.cantidad` por su cuenta, que es como el defecto pudo vivir en
 * las tres a la vez.
 *
 * Se usa el contenido NOMINAL del envase y no la densidad del lote despachado,
 * a propósito: lo que el cliente compró es un balde de 20 litros. Una línea
 * puede haberse servido desde varios lotes con densidades distintas, y hacer
 * un promedio ponderado declararía un volumen que no figura en ningún envase.
 */
export type PresentacionParaComprobante = {
  unidadMedidaSunat: string;
  contenidoKg: number;
  contenidoLitros: number | null;
  producto: { densidadKgL: number | null; temperaturaReferenciaC: number | null };
};

export function cantidadDeclaradaDePresentacion(
  presentacion: PresentacionParaComprobante,
  unidades: number
): CantidadDeclarada {
  const densidad = densidadAplicable({
    densidadProductoKgL: presentacion.producto.densidadKgL,
    temperaturaReferenciaC: presentacion.producto.temperaturaReferenciaC,
  });
  return cantidadDeclarada({
    unidadMedidaSunat: presentacion.unidadMedidaSunat,
    unidades,
    contenidoKg: presentacion.contenidoKg,
    contenidoLitros: presentacion.contenidoLitros,
    densidad: typeof densidad === "string" ? null : densidad,
  });
}
