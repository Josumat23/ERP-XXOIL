import type { $Enums } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Qué declara un producto de lubricante sobre las especificaciones del rubro.
//
// Un distribuidor no pregunta "¿qué aceite es?": pregunta "¿cumple API CK-4?",
// "¿sirve para un motor que pide ACEA E9?". Esa respuesta vive en el maestro de
// producto o no existe.
//
// Hasta ahora vivía en `notasTecnicas`, texto libre. Eso alcanza para que una
// persona lo lea y no alcanza para nada más: no se puede filtrar, no se puede
// listar qué productos cubren una especificación, y sobre todo no distingue
// **cumplir** de estar **homologado** — que en este rubro son cosas distintas.
// ---------------------------------------------------------------------------

export type Organismo = $Enums.OrganismoEspecificacion;
export type TipoCumplimiento = $Enums.TipoCumplimientoEspecificacion;

export type DeclaracionEspecificacion = {
  tipo: TipoCumplimiento;
  numeroAprobacion: string | null;
  vigenteHasta: Date | null;
};

export type ErrorDeclaracion =
  | "APROBACION_SIN_NUMERO"
  | "APROBACION_SIN_VIGENCIA"
  | "CUMPLE_CON_NUMERO"
  | "VIGENCIA_VENCIDA";

export const MENSAJE_ERROR_DECLARACION: Record<ErrorDeclaracion, string> = {
  APROBACION_SIN_NUMERO:
    "Una homologación lleva el número que le dio el organismo. Sin él, quien lea el documento no puede verificarla — si no tiene el número a mano, declárela como «cumple».",
  APROBACION_SIN_VIGENCIA:
    "Una homologación tiene fecha hasta la que rige. Sin ella no se sabe si sigue en pie.",
  CUMPLE_CON_NUMERO:
    "«Cumple» es una declaración propia y no lleva número de aprobación. Si el organismo le otorgó uno, esto es una homologación.",
  VIGENCIA_VENCIDA:
    "La vigencia de la homologación ya pasó. Cargue la renovación o declárela como «cumple».",
};

/**
 * Valida lo que un producto quiere declarar. Devuelve `null` si es coherente.
 *
 * No decide **cuáles** especificaciones cumple un producto — eso es del
 * negocio, y el sistema no tiene forma de saberlo. Solo impide que la
 * declaración se contradiga a sí misma.
 */
export function validarDeclaracion(
  declaracion: DeclaracionEspecificacion,
  hoy: Date = new Date()
): ErrorDeclaracion | null {
  const numero = declaracion.numeroAprobacion?.trim() ?? "";

  if (declaracion.tipo === "CUMPLE") {
    // No se limpia en silencio: si alguien cargó un número, lo más probable es
    // que se haya equivocado de tipo, no de campo.
    return numero ? "CUMPLE_CON_NUMERO" : null;
  }

  if (!numero) return "APROBACION_SIN_NUMERO";
  if (!declaracion.vigenteHasta) return "APROBACION_SIN_VIGENCIA";
  if (declaracion.vigenteHasta.getTime() < hoy.getTime()) return "VIGENCIA_VENCIDA";
  return null;
}

/**
 * Cómo se nombra una especificación en pantalla y en el certificado.
 *
 * Para OEM el organismo no alcanza: «228.31» no significa nada sin
 * «Mercedes-Benz», mientras que «API CK-4» se lee solo.
 */
export function etiquetaEspecificacion(especificacion: {
  organismo: Organismo;
  codigo: string;
  emisor: string | null;
}): string {
  if (especificacion.organismo === "OEM") {
    return especificacion.emisor
      ? `${especificacion.emisor} ${especificacion.codigo}`
      : especificacion.codigo;
  }
  return `${especificacion.organismo} ${especificacion.codigo}`;
}

/**
 * El texto que va en un documento. La homologación dice su número; el
 * cumplimiento no finge tenerlo.
 */
export function textoDeclaracion(declaracion: {
  tipo: TipoCumplimiento;
  numeroAprobacion: string | null;
}): string {
  return declaracion.tipo === "HOMOLOGADO"
    ? `Homologado n.º ${declaracion.numeroAprobacion}`
    : "Cumple";
}

/**
 * Las declaraciones que un documento puede afirmar hoy.
 *
 * Una homologación **vencida** no se imprime. No es una regla legal inventada:
 * es que el documento se emite hoy, y afirmar hoy una aprobación que dejó de
 * regir es afirmar algo que no es cierto. Quien lo reciba puede ir a la lista
 * del organismo y no encontrarla.
 *
 * No se bloquea nada ni se borra el dato: la declaración sigue en la ficha del
 * producto, marcada como vencida, para que alguien cargue la renovación. Lo
 * único que ocurre es que el certificado deja de afirmarla.
 */
export function declaracionesParaDocumento<
  T extends { tipo: TipoCumplimiento; vigenteHasta: Date | null },
>(declaraciones: T[], hoy: Date = new Date()): T[] {
  return declaraciones.filter(
    (d) =>
      d.tipo !== "HOMOLOGADO" ||
      d.vigenteHasta === null ||
      d.vigenteHasta.getTime() >= hoy.getTime()
  );
}

/**
 * Homologaciones que vencen dentro de `dias`. Una aprobación vencida que sigue
 * impresa en los certificados es el problema que esta estructura existe para
 * evitar; avisar antes es la mitad útil.
 */
export function homologacionesPorVencer<
  T extends { tipo: TipoCumplimiento; vigenteHasta: Date | null },
>(declaraciones: T[], dias: number, hoy: Date = new Date()): T[] {
  const limite = hoy.getTime() + dias * 24 * 60 * 60 * 1000;
  return declaraciones.filter(
    (d) =>
      d.tipo === "HOMOLOGADO" &&
      d.vigenteHasta !== null &&
      d.vigenteHasta.getTime() <= limite
  );
}
