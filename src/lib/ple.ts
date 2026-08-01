// ---------------------------------------------------------------------------
// Exportación PLE (Programa de Libros Electrónicos) — Registro de Ventas e
// Ingresos (Formato 14.1) y Registro de Compras (Formato 8.1), según el
// Anexo N° 1 y Anexo N° 2 de la Resolución de Superintendencia N° 361-2015/
// SUNAT (estructura verificada contra los PDF oficiales de sunat.gob.pe).
//
// ALCANCE DELIBERADO: solo los campos que cubren operaciones domésticas
// normales (compras/ventas con proveedores y clientes peruanos, en PEN o
// USD). Quedan fuera a propósito: operaciones con sujetos no domiciliados,
// DUA/aduanas, consolidación de boletas, arroz pilado, y los indicadores de
// cruce contra los padrones que publica SUNAT (RUCs no habidos, etc.) — esos
// necesitan datos externos que este ERP no gestiona. Los campos no usados se
// dejan vacíos, nunca inventados.
// ---------------------------------------------------------------------------

const SEPARADOR = "|";

function num(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "0.00";
  return valor.toFixed(2);
}

function fecha(d: Date | null | undefined): string {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function periodoAAAAMM(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, "0")}00`;
}

// Tabla 2 (SUNAT): tipo de documento de identidad. Solo lo que aplica a
// contrapartes peruanas — RUC (11 dígitos) o DNI (8 dígitos); cualquier otro
// formato (documentos extranjeros) queda sin código, que es una limitación
// conocida de este alcance reducido.
export function codigoTipoDocumento(numeroDocumento: string | null): string {
  if (!numeroDocumento) return "0";
  if (/^\d{11}$/.test(numeroDocumento)) return "6"; // RUC
  if (/^\d{8}$/.test(numeroDocumento)) return "1"; // DNI
  return "0"; // sin documento / no identificado en este alcance
}

// Separa "F001-000123" en { serie: "F001", numero: "000123" }. Si no hay
// guion, todo va al campo número (mejor eso que perder el dato).
export function separarSerieNumero(numeroDocumento: string): { serie: string; numero: string } {
  const idx = numeroDocumento.indexOf("-");
  if (idx === -1) return { serie: "", numero: numeroDocumento };
  return { serie: numeroDocumento.slice(0, idx), numero: numeroDocumento.slice(idx + 1) };
}

export type LineaVenta = {
  correlativo: number;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  tipoComprobante: string; // Tabla 10: "01" Factura, "07" Nota de crédito
  serie: string;
  numero: string;
  tipoDocCliente: string;
  numeroDocCliente: string;
  razonSocialCliente: string;
  baseImponible: number;
  igv: number;
  total: number;
  moneda: string;
  tipoCambio: number | null;
  // Solo para notas de crédito/débito: el comprobante que modifican.
  refFechaEmision?: Date | null;
  refTipoComprobante?: string;
  refSerie?: string;
  refNumero?: string;
};

// Formato 14.1 — 34 campos (no se incluyen los 35-68 de libre utilización).
export function generarLineaVenta(anio: number, mes: number, l: LineaVenta): string[] {
  const esModificatorio = l.tipoComprobante === "07" || l.tipoComprobante === "08";
  return [
    periodoAAAAMM(anio, mes), // 1 periodo
    String(l.correlativo), // 2 CUO/correlativo
    "", // 3 número correlativo (solo ajustes)
    fecha(l.fechaEmision), // 4 fecha emisión
    l.fechaVencimiento ? fecha(l.fechaVencimiento) : "", // 5 fecha vencimiento
    l.tipoComprobante, // 6 tipo comprobante (Tabla 10)
    l.serie, // 7 serie
    l.numero, // 8 número
    "", // 9 número final (consolidado, no aplica)
    l.tipoDocCliente, // 10 tipo doc. cliente (Tabla 2)
    l.numeroDocCliente, // 11 número doc. cliente
    l.razonSocialCliente, // 12 razón social cliente
    "", // 13 valor facturado exportación (no aplica)
    num(l.baseImponible), // 14 base imponible gravada
    "", // 15 descuento base imponible
    num(l.igv), // 16 IGV
    "", // 17 descuento IGV
    "", // 18 operación exonerada
    "", // 19 operación inafecta
    "", // 20 ISC
    "", // 21 base imponible arroz pilado (no aplica)
    "", // 22 IGV arroz pilado (no aplica)
    "", // 23 otros conceptos
    num(l.total), // 24 importe total
    l.moneda === "PEN" ? "" : l.moneda, // 25 moneda (PEN se deja vacío por convención)
    l.moneda === "PEN" ? "" : (l.tipoCambio ?? 1).toFixed(3), // 26 tipo de cambio
    esModificatorio && l.refFechaEmision ? fecha(l.refFechaEmision) : "", // 27 fecha comprobante que modifica
    esModificatorio ? (l.refTipoComprobante ?? "") : "", // 28 tipo comprobante que modifica
    esModificatorio ? (l.refSerie ?? "") : "", // 29 serie comprobante que modifica
    esModificatorio ? (l.refNumero ?? "") : "", // 30 número comprobante que modifica
    "", // 31 identificación de contrato (consorcios)
    "", // 32 error tipo 1 (tipo de cambio)
    "", // 33 indicador cancelado con medios de pago
    "1", // 34 estado: anotado en el período que corresponde
  ];
}

export type LineaCompra = {
  correlativo: number;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  tipoComprobante: string; // Tabla 10: "01" Factura, normalmente
  serie: string;
  numero: string;
  tipoDocProveedor: string;
  numeroDocProveedor: string;
  razonSocialProveedor: string;
  baseImponible: number;
  igv: number;
  total: number;
  moneda: string;
  tipoCambio: number | null;
};

// Formato 8.1 — 41 campos (no se incluyen los 42-82 de libre utilización).
export function generarLineaCompra(anio: number, mes: number, l: LineaCompra): string[] {
  return [
    periodoAAAAMM(anio, mes), // 1 periodo
    String(l.correlativo), // 2 CUO/correlativo
    "", // 3 número correlativo (solo ajustes)
    fecha(l.fechaEmision), // 4 fecha emisión
    l.fechaVencimiento ? fecha(l.fechaVencimiento) : "", // 5 fecha vencimiento
    l.tipoComprobante, // 6 tipo comprobante (Tabla 10)
    l.serie, // 7 serie
    "", // 8 año DUA/DSI (no aplica)
    l.numero, // 9 número
    "", // 10 número final (consolidado, no aplica)
    l.tipoDocProveedor, // 11 tipo doc. proveedor (Tabla 2)
    l.numeroDocProveedor, // 12 RUC/doc. proveedor
    l.razonSocialProveedor, // 13 razón social proveedor
    num(l.baseImponible), // 14 base imponible con derecho a crédito fiscal
    num(l.igv), // 15 IGV
    "", // 16 base imponible mixta (gravada + no gravada)
    "", // 17 IGV de la línea 16
    "", // 18 base imponible sin derecho a crédito fiscal
    "", // 19 IGV de la línea 18
    "", // 20 valor de adquisiciones no gravadas
    "", // 21 ISC deducible
    "", // 22 otros conceptos
    num(l.total), // 23 importe total
    l.moneda === "PEN" ? "" : l.moneda, // 24 moneda (PEN se deja vacío por convención)
    l.moneda === "PEN" ? "" : (l.tipoCambio ?? 1).toFixed(3), // 25 tipo de cambio
    "", // 26 fecha comprobante que se modifica (NC/ND de compra, no aplica en este alcance)
    "", // 27 tipo comprobante que se modifica
    "", // 28 serie comprobante que se modifica
    "", // 29 código dependencia aduanera
    "", // 30 número comprobante que se modifica
    "", // 31 fecha constancia de detracción
    "", // 32 número constancia de detracción
    "", // 33 marca de comprobante sujeto a retención
    "", // 34 clasificación de bienes/servicios (Tabla 30, solo >1500 UIT)
    "", // 35 identificación de contrato (consorcios)
    "", // 36 error tipo 1 (tipo de cambio)
    "", // 37 error tipo 2 (proveedor no habido)
    "", // 38 error tipo 3 (renuncia a exoneración)
    "", // 39 error tipo 4 (DNI con RUC ya creado)
    "", // 40 indicador cancelado con medios de pago
    "1", // 41 estado: anotado en el período que se emitió, con derecho a crédito fiscal
  ];
}

export function generarArchivoPLE(lineas: string[][]): string {
  return lineas.map((l) => l.join(SEPARADOR)).join("\r\n");
}
