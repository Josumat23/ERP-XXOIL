import type { $Enums } from "@/generated/prisma/client";

// Catálogo 9 de SUNAT (tipo de nota de crédito) — el código real que exige
// el XML/JSON del comprobante, no el texto libre del motivo.
export const CODIGO_TIPO_NOTA_CREDITO: Record<$Enums.TipoNotaCredito, string> = {
  ANULACION_OPERACION: "01",
  ANULACION_ERROR_RUC: "02",
  CORRECCION_DESCRIPCION: "03",
  DESCUENTO_GLOBAL: "04",
  DESCUENTO_ITEM: "05",
  DEVOLUCION_TOTAL: "06",
  DEVOLUCION_ITEM: "07",
  BONIFICACION: "08",
  DISMINUCION_VALOR: "09",
  OTROS_CONCEPTOS: "10",
};

export const ETIQUETA_TIPO_NOTA_CREDITO: Record<$Enums.TipoNotaCredito, string> = {
  ANULACION_OPERACION: "Anulación de la operación",
  ANULACION_ERROR_RUC: "Anulación por error en el RUC",
  CORRECCION_DESCRIPCION: "Corrección por error en la descripción",
  DESCUENTO_GLOBAL: "Descuento global",
  DESCUENTO_ITEM: "Descuento por ítem",
  DEVOLUCION_TOTAL: "Devolución total",
  DEVOLUCION_ITEM: "Devolución por ítem",
  BONIFICACION: "Bonificación",
  DISMINUCION_VALOR: "Disminución en el valor",
  OTROS_CONCEPTOS: "Otros conceptos",
};

// Catálogo 20 de SUNAT (modalidad de transporte de la guía de remisión).
export const CODIGO_MODALIDAD_TRANSPORTE: Record<$Enums.ModalidadTransporte, string> = {
  PUBLICO: "01",
  PRIVADO: "02",
};

export const ETIQUETA_MODALIDAD_TRANSPORTE: Record<$Enums.ModalidadTransporte, string> = {
  PUBLICO: "Transporte público",
  PRIVADO: "Transporte privado",
};
