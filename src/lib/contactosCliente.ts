// Contactos del maestro de clientes.
//
// Funciones puras, sin Prisma.
//
// Hasta el 2026-09-14 había UN solo contacto, en dos campos sueltos del
// cliente. En un distribuidor, quien aprueba el pedido no es quien recibe la
// factura ni quien atiende al camión; con un solo casillero, el que quedaba
// escrito era el último que llamó.

export type Proposito = "PEDIDOS" | "FACTURACION" | "COBRANZA" | "DESPACHO";

export const PROPOSITOS: readonly Proposito[] = [
  "PEDIDOS",
  "FACTURACION",
  "COBRANZA",
  "DESPACHO",
];

export const ETIQUETA_PROPOSITO: Record<Proposito, string> = {
  PEDIDOS: "Pedidos",
  FACTURACION: "Facturación",
  COBRANZA: "Cobranza",
  DESPACHO: "Despacho",
};

/** El campo del modelo que corresponde a cada propósito. */
export const CAMPO_PROPOSITO: Record<Proposito, "paraPedidos" | "paraFacturacion" | "paraCobranza" | "paraDespacho"> = {
  PEDIDOS: "paraPedidos",
  FACTURACION: "paraFacturacion",
  COBRANZA: "paraCobranza",
  DESPACHO: "paraDespacho",
};

export type ErrorContacto =
  | "SIN_NOMBRE"
  | "NOMBRE_LARGO"
  | "EMAIL_INVALIDO"
  | "SIN_CANAL"
  | "PRINCIPAL_INACTIVO";

export const MENSAJE_ERROR_CONTACTO: Record<ErrorContacto, string> = {
  SIN_NOMBRE: "Ingrese al menos el nombre del contacto.",
  NOMBRE_LARGO: "El nombre no puede superar 120 caracteres.",
  EMAIL_INVALIDO: "El correo no tiene un formato válido.",
  SIN_CANAL:
    "Un contacto marcado para pedidos, facturación, cobranza o despacho necesita teléfono, celular o correo: si no, nadie puede avisarle.",
  PRINCIPAL_INACTIVO:
    "Un contacto inactivo no puede ser el principal. Marque otro como principal primero.",
};

/**
 * Validación de correo deliberadamente simple.
 *
 * Comprueba que haya algo antes de la arroba, algo después, un punto en el
 * dominio y ningún espacio. No intenta implementar el RFC: una expresión
 * regular «completa» rechaza direcciones válidas y da una falsa sensación de
 * verificación. Lo único que prueba de verdad que un correo existe es
 * escribirle, y eso todavía no se hace desde acá.
 */
export function emailPlausible(email: string): boolean {
  if (/\s/.test(email)) return false;
  const partes = email.split("@");
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  if (local.length === 0 || dominio.length < 3) return false;
  const punto = dominio.lastIndexOf(".");
  return punto > 0 && punto < dominio.length - 1;
}

export type DatosContacto = {
  nombres: string;
  email: string | null;
  telefono: string | null;
  celular: string | null;
  paraPedidos: boolean;
  paraFacturacion: boolean;
  paraCobranza: boolean;
  paraDespacho: boolean;
  principal: boolean;
  activo: boolean;
};

export function validarContacto(datos: DatosContacto): ErrorContacto | null {
  const nombres = datos.nombres.trim();
  if (!nombres) return "SIN_NOMBRE";
  if (nombres.length > 120) return "NOMBRE_LARGO";

  if (datos.email && !emailPlausible(datos.email.trim())) return "EMAIL_INVALIDO";

  // Un contacto sin forma de contactarlo sigue sirviendo —saber quién decide
  // es un dato— pero marcarlo para un propósito es decir «a este avísenle», y
  // eso sí exige por dónde.
  const marcado =
    datos.paraPedidos || datos.paraFacturacion || datos.paraCobranza || datos.paraDespacho;
  const alcanzable = Boolean(datos.telefono?.trim() || datos.celular?.trim() || datos.email?.trim());
  if (marcado && !alcanzable) return "SIN_CANAL";

  if (datos.principal && !datos.activo) return "PRINCIPAL_INACTIVO";

  return null;
}

export type ContactoResumible = {
  id: string;
  activo: boolean;
  esPrincipal: boolean | null;
  paraPedidos: boolean;
  paraFacturacion: boolean;
  paraCobranza: boolean;
  paraDespacho: boolean;
};

/**
 * A quién buscar para un propósito.
 *
 * Primero quien está marcado para eso; si hay varios, el principal entre
 * ellos, y si ninguno de los marcados lo es, el primero. Si nadie está
 * marcado, cae en el principal del cliente — que es lo que hoy hace una
 * persona cuando no encuentra a quién más llamar.
 *
 * Devuelve `null` cuando no hay ningún contacto activo: es información que
 * falta, no un defecto que haya que tapar eligiendo a cualquiera.
 */
export function contactoPara(
  contactos: readonly ContactoResumible[],
  proposito: Proposito
): string | null {
  const activos = contactos.filter((c) => c.activo);
  if (activos.length === 0) return null;

  const campo = CAMPO_PROPOSITO[proposito];
  const marcados = activos.filter((c) => c[campo]);
  if (marcados.length > 0) {
    return (marcados.find((c) => c.esPrincipal) ?? marcados[0]).id;
  }
  return activos.find((c) => c.esPrincipal)?.id ?? null;
}

/**
 * Propósitos que nadie atiende, para avisarlo en la ficha.
 *
 * No incluye el principal como comodín a propósito: la pregunta es «¿hay
 * alguien designado para esto?», y contestarla con «bueno, está el principal»
 * es justamente lo que se quiere dejar de hacer.
 */
export function propositosSinContacto(contactos: readonly ContactoResumible[]): Proposito[] {
  const activos = contactos.filter((c) => c.activo);
  return PROPOSITOS.filter((p) => !activos.some((c) => c[CAMPO_PROPOSITO[p]]));
}

/** Nombre completo para mostrar, sin dobles espacios cuando no hay apellidos. */
export function nombreCompleto(contacto: { nombres: string; apellidos?: string | null }): string {
  return [contacto.nombres, contacto.apellidos].filter(Boolean).join(" ").trim();
}
