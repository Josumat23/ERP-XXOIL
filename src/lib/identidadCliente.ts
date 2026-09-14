// Identificación del cliente: quién es y en qué estado está.
//
// Funciones puras, sin Prisma.

export type TipoPersona = "NATURAL" | "JURIDICA";
export type EstadoCliente = "ACTIVO" | "BLOQUEADO" | "INACTIVO";

export const ETIQUETA_TIPO_PERSONA: Record<TipoPersona, string> = {
  NATURAL: "Persona natural",
  JURIDICA: "Persona jurídica",
};

export const ETIQUETA_ESTADO_CLIENTE: Record<EstadoCliente, string> = {
  ACTIVO: "Activo",
  BLOQUEADO: "Bloqueado",
  INACTIVO: "Inactivo",
};

/** Documentos que solo puede tener una persona natural. */
const DOCUMENTOS_DE_PERSONA: readonly string[] = ["DNI", "CARNET_EXTRANJERIA", "PASAPORTE", "CI"];

/**
 * Qué tipo de persona declara un RUC peruano por su prefijo.
 *
 * SUNAT estructura el RUC con dos dígitos iniciales que dicen qué es el
 * contribuyente: **10** es persona natural con negocio y **20** es persona
 * jurídica. Son los dos casos inequívocos y los únicos que se juzgan aquí;
 * existen otros prefijos (15, 17…) con historia y excepciones, y clasificarlos
 * por cuenta propia sería inventar una regla tributaria.
 *
 * Devuelve `null` cuando no hay nada seguro que decir.
 */
export function tipoPersonaSegunRuc(ruc: string | null): TipoPersona | null {
  if (!ruc) return null;
  const limpio = ruc.trim();
  if (!/^\d{11}$/.test(limpio)) return null;
  if (limpio.startsWith("10")) return "NATURAL";
  if (limpio.startsWith("20")) return "JURIDICA";
  return null;
}

export type ErrorIdentidad =
  | "PERSONA_CON_DOCUMENTO_DE_EMPRESA"
  | "EMPRESA_CON_DOCUMENTO_DE_PERSONA"
  | "TIPO_PERSONA_CONTRADICE_RUC"
  | "BLOQUEO_SIN_MOTIVO"
  | "MOTIVO_LARGO";

export const MENSAJE_ERROR_IDENTIDAD: Record<ErrorIdentidad, string> = {
  PERSONA_CON_DOCUMENTO_DE_EMPRESA:
    "Una persona natural no se identifica con un documento de empresa extranjero. Revise el tipo de persona o el documento.",
  EMPRESA_CON_DOCUMENTO_DE_PERSONA:
    "Una persona jurídica no se identifica con DNI, carné de extranjería ni pasaporte.",
  TIPO_PERSONA_CONTRADICE_RUC:
    "El RUC contradice el tipo de persona: los que empiezan en 10 son de persona natural y los que empiezan en 20, de persona jurídica.",
  BLOQUEO_SIN_MOTIVO:
    "Bloquear o desactivar a un cliente necesita el motivo: es lo que va a leer quien lo reactive.",
  MOTIVO_LARGO: "El motivo no puede superar 500 caracteres.",
};

/**
 * Coherencia entre el tipo de persona y el documento declarado.
 *
 * No inventa validaciones de dígito verificador ni consulta a SUNAT — no hay
 * servicio conectado. Comprueba lo único que se puede comprobar con los datos
 * a la vista: que las dos declaraciones no se contradigan entre sí.
 */
export function validarIdentidad(params: {
  tipoPersona: string | null;
  tipoDocumentoFiscal: string;
  documento: string | null;
  estado: string;
  motivoEstado: string;
}): ErrorIdentidad | null {
  const { tipoPersona, tipoDocumentoFiscal, documento } = params;

  if (tipoPersona === "JURIDICA" && DOCUMENTOS_DE_PERSONA.includes(tipoDocumentoFiscal)) {
    return "EMPRESA_CON_DOCUMENTO_DE_PERSONA";
  }

  if (tipoPersona) {
    const segunRuc = tipoPersonaSegunRuc(tipoDocumentoFiscal === "RUC" ? documento : null);
    if (segunRuc && segunRuc !== tipoPersona) return "TIPO_PERSONA_CONTRADICE_RUC";
  }

  // Bloquear o desactivar le cierra la puerta a alguien: esa decisión tiene
  // que poder releerse. Reactivar no necesita explicación.
  const motivo = params.motivoEstado.trim();
  if (params.estado !== "ACTIVO" && !motivo) return "BLOQUEO_SIN_MOTIVO";
  if (motivo.length > 500) return "MOTIVO_LARGO";

  return null;
}

export type MotivoNoOperable = "INACTIVO" | "BLOQUEADO" | "COBRANZA";

export const MENSAJE_NO_OPERABLE: Record<MotivoNoOperable, string> = {
  INACTIVO: "El cliente está inactivo.",
  BLOQUEADO: "El cliente está bloqueado en el maestro.",
  COBRANZA:
    "El cliente está bloqueado por cobranza (facturas vencidas sin regularizar). Levante el bloqueo en Finanzas → Gestión de cobranza.",
};

/**
 * ¿Se le puede vender?
 *
 * Los dos controles son **ortogonales a propósito** y hay que pasar los dos.
 * `estado` es una decisión de una persona sobre el maestro; `bloqueadoCobranza`
 * es un control financiero automático. Fundirlos haría que regularizar una
 * deuda desbloquee a un cliente que legal había frenado, que es exactamente lo
 * que un control no debe permitir.
 *
 * El orden importa para el mensaje: un cliente inactivo Y con deuda tiene un
 * problema más grande que la deuda.
 */
export function motivoNoOperable(cliente: {
  estado: string;
  bloqueadoCobranza: boolean;
}): MotivoNoOperable | null {
  if (cliente.estado === "INACTIVO") return "INACTIVO";
  if (cliente.estado === "BLOQUEADO") return "BLOQUEADO";
  if (cliente.bloqueadoCobranza) return "COBRANZA";
  return null;
}

/** Filtro compartido: qué significa «cliente seleccionable» en una lista. */
export const CLIENTE_SELECCIONABLE = { estado: "ACTIVO" } as const;
