// Qué comprobante corresponde emitir a un cliente.
//
// **La regla sale del documento del comprador, no del canal comercial.** Un
// cliente del canal minorista que es una empresa con RUC recibe factura; una
// persona natural con DNI recibe boleta, venda lo que venda. El canal
// (`CanalCliente`) gobierna descuentos y reportes comerciales, no el tipo de
// comprobante — confundirlos emitiría el documento equivocado a la mitad de la
// cartera.
//
// No se inventa nada aquí: es la distinción que hace el propio Catálogo 01 de
// SUNAT, que este repo ya citaba en el esquema ("01 Factura, 03 Boleta").
//
// Funciones puras: no tocan la base.

export type TipoComprobanteVenta = "FACTURA" | "BOLETA";

export type DocumentoComprador = {
  /** Tipo de documento fiscal del cliente. "RUC" cubre el caso peruano. */
  tipoDocumentoFiscal: string;
  /** Número tal como está registrado. */
  documento: string | null;
};

/** Un RUC peruano tiene 11 dígitos; un DNI, 8. */
export function esRucPeruano(documento: string | null): boolean {
  return documento !== null && /^\d{11}$/.test(documento.trim());
}

export function esDniPeruano(documento: string | null): boolean {
  return documento !== null && /^\d{8}$/.test(documento.trim());
}

/**
 * Comprobante que corresponde emitir.
 *
 * - Con RUC peruano (11 dígitos): **factura**.
 * - Con DNI (8 dígitos) o sin documento: **boleta**.
 * - Con documento fiscal extranjero (RUT, NIT, RFC, EIN, VAT…): **factura**,
 *   que es el comportamiento que el sistema ya tenía para venta al exterior.
 *   Una boleta es un comprobante para consumidor final peruano; darle una a un
 *   cliente extranjero sería peor que dejar la factura como estaba.
 */
export function tipoComprobantePara(cliente: DocumentoComprador): TipoComprobanteVenta {
  if (cliente.tipoDocumentoFiscal !== "RUC") return "FACTURA";
  if (esRucPeruano(cliente.documento)) return "FACTURA";
  return "BOLETA";
}

/**
 * Código del Catálogo 06 de SUNAT (tipo de documento de identidad del
 * adquirente), que es lo que el OSE espera junto al número.
 *
 * Antes estaba fijo en 6 (RUC) para todos, así que el DNI de un cliente se
 * declaraba a SUNAT como si fuera un RUC.
 */
export function codigoDocumentoIdentidad(cliente: DocumentoComprador): number {
  if (cliente.tipoDocumentoFiscal !== "RUC") return 0; // sin documento / otros
  if (esRucPeruano(cliente.documento)) return 6; // RUC
  if (esDniPeruano(cliente.documento)) return 1; // DNI
  return 0;
}

/**
 * Prefijo de serie que SUNAT exige según el comprobante: las series de factura
 * empiezan con F y las de boleta con B.
 *
 * Se usa para avisar cuando una serie configurada no corresponde al documento
 * que se va a emitir, no para corregirla en silencio.
 */
export function prefijoSerieEsperado(tipo: TipoComprobanteVenta): string {
  return tipo === "BOLETA" ? "B" : "F";
}

export function serieCoincideConTipo(serie: string, tipo: TipoComprobanteVenta): boolean {
  const prefijo = serie.trim().charAt(0).toUpperCase();
  return prefijo === prefijoSerieEsperado(tipo);
}
