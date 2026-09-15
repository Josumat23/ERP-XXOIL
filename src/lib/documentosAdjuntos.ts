// Documentos de respaldo: qué son y cuándo dejan de valer.
//
// Funciones puras, sin Prisma.
//
// Un contrato o una licencia vencidos son un riesgo operativo real, y sin
// fecha de vencimiento nadie se entera hasta que alguien los busca — que suele
// ser el día en que hacen falta.

export type TipoDocumentoAdjunto =
  | "CONTRATO"
  | "FICHA_RUC"
  | "CONSTANCIA_BANCARIA"
  | "LICENCIA"
  | "CERTIFICADO"
  | "OTRO";

export const TIPOS_DOCUMENTO: readonly TipoDocumentoAdjunto[] = [
  "CONTRATO",
  "FICHA_RUC",
  "CONSTANCIA_BANCARIA",
  "LICENCIA",
  "CERTIFICADO",
  "OTRO",
];

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumentoAdjunto, string> = {
  CONTRATO: "Contrato comercial",
  FICHA_RUC: "Ficha RUC",
  CONSTANCIA_BANCARIA: "Constancia bancaria",
  LICENCIA: "Licencia",
  CERTIFICADO: "Certificado",
  OTRO: "Otro documento",
};

/**
 * Con cuántos días de anticipación se avisa que un documento va a vencer.
 *
 * 30 días alcanza para renovar un contrato o una licencia sin corriendo. No
 * sale de ninguna norma: es un criterio operativo, y por eso está acá con
 * nombre, para poder discutirlo.
 */
export const DIAS_AVISO_VENCIMIENTO = 30;

export type Vigencia = "SIN_VENCIMIENTO" | "VIGENTE" | "POR_VENCER" | "VENCIDO";

export function vigenciaDocumento(
  venceEl: Date | null,
  hoy: Date = new Date(),
  diasAviso: number = DIAS_AVISO_VENCIMIENTO
): Vigencia {
  if (venceEl === null) return "SIN_VENCIMIENTO";

  const MS_DIA = 24 * 60 * 60 * 1000;
  // Se comparan días completos: un documento que vence hoy sigue valiendo hoy.
  const dias = Math.floor((venceEl.getTime() - hoy.getTime()) / MS_DIA);
  if (dias < 0) return "VENCIDO";
  if (dias <= diasAviso) return "POR_VENCER";
  return "VIGENTE";
}

export function diasParaVencer(venceEl: Date, hoy: Date = new Date()): number {
  return Math.floor((venceEl.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

export type DocumentoConVigencia = {
  id: string;
  nombreOriginal: string;
  tipoDocumento: string | null;
  venceEl: Date | null;
};

export type AvisoDocumento = {
  documento: DocumentoConVigencia;
  vigencia: Extract<Vigencia, "VENCIDO" | "POR_VENCER">;
  dias: number;
};

/**
 * Los documentos que piden atención, el más urgente primero.
 *
 * Solo vencidos y por vencer: listar los vigentes convertiría el aviso en un
 * inventario, y un aviso que siempre tiene contenido deja de mirarse.
 */
export function documentosPorAtender(
  documentos: readonly DocumentoConVigencia[],
  hoy: Date = new Date(),
  diasAviso: number = DIAS_AVISO_VENCIMIENTO
): AvisoDocumento[] {
  const avisos: AvisoDocumento[] = [];
  for (const documento of documentos) {
    if (documento.venceEl === null) continue;
    const vigencia = vigenciaDocumento(documento.venceEl, hoy, diasAviso);
    if (vigencia !== "VENCIDO" && vigencia !== "POR_VENCER") continue;
    avisos.push({ documento, vigencia, dias: diasParaVencer(documento.venceEl, hoy) });
  }
  return avisos.sort((a, b) => a.dias - b.dias);
}

export function mensajeAvisoDocumento(aviso: AvisoDocumento): string {
  const nombre = aviso.documento.tipoDocumento
    ? ETIQUETA_TIPO_DOCUMENTO[aviso.documento.tipoDocumento as TipoDocumentoAdjunto]
    : aviso.documento.nombreOriginal;
  if (aviso.vigencia === "VENCIDO") {
    const dias = Math.abs(aviso.dias);
    return `${nombre}: venció hace ${dias} ${dias === 1 ? "día" : "días"}.`;
  }
  return aviso.dias === 0
    ? `${nombre}: vence hoy.`
    : `${nombre}: vence en ${aviso.dias} ${aviso.dias === 1 ? "día" : "días"}.`;
}

export type ErrorDocumento = "TIPO_INVALIDO" | "VENCIMIENTO_SIN_TIPO";

export const MENSAJE_ERROR_DOCUMENTO: Record<ErrorDocumento, string> = {
  TIPO_INVALIDO: "El tipo de documento no es uno de los conocidos.",
  VENCIMIENTO_SIN_TIPO:
    "Para ponerle vencimiento a un archivo hay que decir qué documento es: si no, el aviso no sabría de qué está hablando.",
};

export function validarDocumento(params: {
  tipoDocumento: string | null;
  venceEl: Date | null;
}): ErrorDocumento | null {
  if (
    params.tipoDocumento !== null &&
    !(TIPOS_DOCUMENTO as readonly string[]).includes(params.tipoDocumento)
  ) {
    return "TIPO_INVALIDO";
  }
  // Un vencimiento suelto produciría un aviso que dice «archivo.pdf venció»,
  // que no le sirve a nadie.
  if (params.venceEl !== null && params.tipoDocumento === null) return "VENCIMIENTO_SIN_TIPO";
  return null;
}
