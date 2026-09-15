// Datos fiscales declarados del cliente.
//
// Funciones puras, sin Prisma.
//
// **Nada de esto se valida contra SUNAT**: no hay servicio conectado. Todo se
// carga a mano desde la ficha RUC, y por eso lo que importa acá no es el dato
// en sí sino **cuán viejo es**. Un estado de RUC cacheado y nunca refrescado
// deja de ser un dato y pasa a ser una afirmación falsa.

export type EstadoRuc =
  | "ACTIVO"
  | "SUSPENSION_TEMPORAL"
  | "BAJA_PROVISIONAL"
  | "BAJA_DEFINITIVA"
  | "BAJA_DE_OFICIO";

export type CondicionRuc = "HABIDO" | "NO_HABIDO" | "NO_HALLADO" | "PENDIENTE";

export const ETIQUETA_ESTADO_RUC: Record<EstadoRuc, string> = {
  ACTIVO: "Activo",
  SUSPENSION_TEMPORAL: "Suspensión temporal",
  BAJA_PROVISIONAL: "Baja provisional",
  BAJA_DEFINITIVA: "Baja definitiva",
  BAJA_DE_OFICIO: "Baja de oficio",
};

export const ETIQUETA_CONDICION_RUC: Record<CondicionRuc, string> = {
  HABIDO: "Habido",
  NO_HABIDO: "No habido",
  NO_HALLADO: "No hallado",
  PENDIENTE: "Pendiente",
};

/**
 * A los cuántos días una consulta deja de servir.
 *
 * 180 días es medio año: suficiente para no pedir una consulta por cada venta,
 * y poco para que un cliente dado de baja pase inadvertido una campaña entera.
 * No sale de ninguna norma — es un criterio operativo, y por eso está acá
 * arriba y con nombre, para poder discutirlo.
 */
export const DIAS_VIGENCIA_CONSULTA = 180;

export function diasDesdeConsulta(consultadoEn: Date | null, hoy: Date = new Date()): number | null {
  if (consultadoEn === null) return null;
  const ms = hoy.getTime() - consultadoEn.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export type AvisoFiscal =
  | { tipo: "SIN_CONSULTA" }
  | { tipo: "CONSULTA_VIEJA"; dias: number }
  | { tipo: "ESTADO_NO_ACTIVO"; estado: EstadoRuc }
  | { tipo: "NO_UBICABLE"; condicion: CondicionRuc };

/**
 * Qué habría que mirar antes de facturarle.
 *
 * **Avisa, no bloquea.** El dato es manual: frenar una venta por una consulta
 * que alguien no actualizó castigaría al vendedor por una tarea
 * administrativa ajena. Y un cliente puede estar «no hallado» y seguir
 * comprando al contado sin problema.
 *
 * Los avisos se devuelven todos, no el primero: que la consulta esté vieja no
 * quita que el estado que registra ya sea malo.
 */
export function avisosFiscales(
  cliente: {
    estadoRuc: string | null;
    condicionRuc: string | null;
    rucConsultadoEn: Date | null;
    tipoDocumentoFiscal: string;
  },
  hoy: Date = new Date()
): AvisoFiscal[] {
  // Solo aplica a quien tiene RUC: a una persona con DNI no se le consulta
  // estado de contribuyente.
  if (cliente.tipoDocumentoFiscal !== "RUC") return [];

  const avisos: AvisoFiscal[] = [];

  if (cliente.estadoRuc !== null && cliente.estadoRuc !== "ACTIVO") {
    avisos.push({ tipo: "ESTADO_NO_ACTIVO", estado: cliente.estadoRuc as EstadoRuc });
  }
  if (cliente.condicionRuc === "NO_HABIDO" || cliente.condicionRuc === "NO_HALLADO") {
    avisos.push({ tipo: "NO_UBICABLE", condicion: cliente.condicionRuc });
  }

  const dias = diasDesdeConsulta(cliente.rucConsultadoEn, hoy);
  if (dias === null) {
    // Solo se reclama la consulta si hay algo que consultar declarado, o si el
    // cliente tiene RUC y nadie lo miró nunca.
    avisos.push({ tipo: "SIN_CONSULTA" });
  } else if (dias > DIAS_VIGENCIA_CONSULTA) {
    avisos.push({ tipo: "CONSULTA_VIEJA", dias });
  }

  return avisos;
}

export function mensajeAvisoFiscal(aviso: AvisoFiscal): string {
  switch (aviso.tipo) {
    case "SIN_CONSULTA":
      return "Nadie consultó todavía el estado del RUC de este cliente en SUNAT.";
    case "CONSULTA_VIEJA":
      return `La consulta del RUC tiene ${aviso.dias} días: conviene repetirla antes de darle crédito.`;
    case "ESTADO_NO_ACTIVO":
      return `Según lo registrado, su RUC está en ${ETIQUETA_ESTADO_RUC[aviso.estado].toLowerCase()}. Un comprobante a un RUC que no está activo puede ser observado.`;
    case "NO_UBICABLE":
      return `Según lo registrado, su domicilio figura como ${ETIQUETA_CONDICION_RUC[aviso.condicion].toLowerCase()} ante SUNAT.`;
  }
}

export type ErrorDatosFiscales =
  | "ESTADO_SIN_CONSULTA"
  | "CONSULTA_FUTURA"
  | "SIN_FUENTE"
  | "TEXTO_LARGO";

export const MENSAJE_ERROR_FISCAL: Record<ErrorDatosFiscales, string> = {
  ESTADO_SIN_CONSULTA:
    "Si registra el estado o la condición del RUC, indique también cuándo se consultó: sin fecha no se puede saber si el dato sigue vigente.",
  CONSULTA_FUTURA: "La fecha de consulta no puede estar en el futuro.",
  SIN_FUENTE: "Indique de dónde salió la consulta (ficha RUC, consulta en línea, tercero).",
  TEXTO_LARGO: "El texto no puede superar 200 caracteres.",
};

export function validarDatosFiscales(
  params: {
    estadoRuc: string | null;
    condicionRuc: string | null;
    rucConsultadoEn: Date | null;
    rucFuenteConsulta: string | null;
    tipoContribuyente: string | null;
    afectacionTributaria: string | null;
  },
  hoy: Date = new Date()
): ErrorDatosFiscales | null {
  const declaraAlgo = params.estadoRuc !== null || params.condicionRuc !== null;

  // Un estado sin fecha es justamente el dato que después nadie sabe si vale.
  if (declaraAlgo && params.rucConsultadoEn === null) return "ESTADO_SIN_CONSULTA";
  if (declaraAlgo && !params.rucFuenteConsulta?.trim()) return "SIN_FUENTE";

  if (params.rucConsultadoEn !== null && params.rucConsultadoEn.getTime() > hoy.getTime()) {
    return "CONSULTA_FUTURA";
  }

  for (const texto of [
    params.tipoContribuyente,
    params.afectacionTributaria,
    params.rucFuenteConsulta,
  ]) {
    if (texto !== null && texto.trim().length > 200) return "TEXTO_LARGO";
  }

  return null;
}
