// Direcciones del maestro de clientes.
//
// Funciones puras, sin Prisma.
//
// Un cliente tiene varias direcciones y cada una cumple un papel distinto:
// dónde está domiciliado ante SUNAT no es dónde quiere recibir la factura, ni
// dónde hay que dejarle los cilindros, ni dónde se le va a cobrar.
//
// Hasta el 2026-09-14 había una sola, y la de entrega se retipeaba a mano en
// cada pedido.

export type TipoDireccion = "FISCAL" | "FACTURACION" | "ENTREGA" | "COBRANZA";

export const TIPOS_DIRECCION: readonly TipoDireccion[] = [
  "FISCAL",
  "FACTURACION",
  "ENTREGA",
  "COBRANZA",
];

export const ETIQUETA_TIPO_DIRECCION: Record<TipoDireccion, string> = {
  FISCAL: "Domicilio fiscal",
  FACTURACION: "Facturación",
  ENTREGA: "Entrega",
  COBRANZA: "Cobranza",
};

export type ErrorDireccion =
  | "TIPO_INVALIDO"
  | "SIN_DIRECCION"
  | "DIRECCION_LARGA"
  | "SIN_UBICACION"
  | "COORDENADA_INVALIDA"
  | "PRINCIPAL_INACTIVA";

export const MENSAJE_ERROR_DIRECCION: Record<ErrorDireccion, string> = {
  TIPO_INVALIDO: "Indique para qué sirve esta dirección.",
  SIN_DIRECCION: "Ingrese la dirección.",
  DIRECCION_LARGA: "La dirección no puede superar 500 caracteres.",
  SIN_UBICACION:
    "Una dirección de entrega necesita distrito: es lo que usa el reparto para agrupar y cotizar el flete.",
  COORDENADA_INVALIDA:
    "Las coordenadas deben estar dentro de rango (latitud −90 a 90, longitud −180 a 180).",
  PRINCIPAL_INACTIVA:
    "Una dirección inactiva no puede ser la principal de su tipo. Marque otra como principal primero.",
};

export function validarDireccion(params: {
  tipo: string;
  direccion: string;
  ubigeoId: string | null;
  latitud: number | null;
  longitud: number | null;
  principal: boolean;
  activa: boolean;
}): ErrorDireccion | null {
  if (!TIPOS_DIRECCION.includes(params.tipo as TipoDireccion)) return "TIPO_INVALIDO";

  const direccion = params.direccion.trim();
  if (!direccion) return "SIN_DIRECCION";
  if (direccion.length > 500) return "DIRECCION_LARGA";

  // Solo la de entrega exige ubigeo. Es la que el reparto usa para agrupar y
  // la que la licitación de flete necesita para cotizar un tramo; las otras
  // tres son datos administrativos y muchas veces llegan sin distrito.
  if (params.tipo === "ENTREGA" && !params.ubigeoId) return "SIN_UBICACION";

  if (params.latitud !== null && Math.abs(params.latitud) > 90) return "COORDENADA_INVALIDA";
  if (params.longitud !== null && Math.abs(params.longitud) > 180) return "COORDENADA_INVALIDA";

  // Marcar como principal algo que está desactivado deja al tipo sin principal
  // utilizable, que es peor que no tener ninguna.
  if (params.principal && !params.activa) return "PRINCIPAL_INACTIVA";

  return null;
}

/** El valor que va en `principalDe`: el tipo si es principal, null si no. */
export function valorPrincipalDe(tipo: TipoDireccion, principal: boolean): TipoDireccion | null {
  return principal ? tipo : null;
}

export type DireccionResumible = {
  id: string;
  tipo: string;
  principalDe: string | null;
  activa: boolean;
};

/**
 * Cuál usar para un tipo dado.
 *
 * Preferencia: la principal activa de ese tipo; si no hay, la única activa de
 * ese tipo. Con varias y ninguna principal devuelve `null` en vez de elegir
 * una: adivinar a cuál de tres plantas va el despacho es peor que pedir que
 * alguien lo diga.
 */
export function direccionPara(
  direcciones: readonly DireccionResumible[],
  tipo: TipoDireccion
): string | null {
  const activas = direcciones.filter((d) => d.tipo === tipo && d.activa);
  const principal = activas.find((d) => d.principalDe === tipo);
  if (principal) return principal.id;
  return activas.length === 1 ? activas[0].id : null;
}

/**
 * Tipos sin ninguna dirección activa, para avisarlo en la ficha.
 *
 * FISCAL siempre hace falta —sin domicilio no hay comprobante— y ENTREGA hace
 * falta en cuanto el cliente compre algo que haya que llevarle. FACTURACION y
 * COBRANZA caen en la fiscal cuando no se declaran, así que no se reclaman.
 */
export function tiposFaltantes(direcciones: readonly DireccionResumible[]): TipoDireccion[] {
  const faltan: TipoDireccion[] = [];
  for (const tipo of ["FISCAL", "ENTREGA"] as const) {
    if (!direcciones.some((d) => d.tipo === tipo && d.activa)) faltan.push(tipo);
  }
  return faltan;
}
