import type { $Enums } from "@/generated/prisma/client";

export const ETIQUETA_ORIGEN: Record<$Enums.OrigenMovimiento, string> = {
  STOCK_INICIAL: "Stock inicial",
  COMPRA: "Compra",
  PRODUCCION: "Producción",
  ENVASADO: "Envasado",
  VENTA: "Venta",
  ANULACION_VENTA: "Anulación de venta",
  AJUSTE: "Ajuste",
};

export const ETIQUETA_ESTADO_LOTE: Record<$Enums.EstadoLote, string> = {
  EN_PROCESO: "En proceso",
  PENDIENTE_CALIDAD: "Pendiente de calidad",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export const ETIQUETA_TIPO_INSUMO: Record<$Enums.TipoInsumo, string> = {
  MATERIA_PRIMA: "Materia prima",
  ENVASE: "Envase",
  ETIQUETA: "Etiqueta",
};

export const ETIQUETA_TIPO_VENDEDOR: Record<$Enums.TipoVendedor, string> = {
  CON_BASICO: "Con básico",
  SOLO_COMISION: "Solo comisión",
};

export const ETIQUETA_ESTADO_PEDIDO: Record<$Enums.EstadoPedido, string> = {
  PENDIENTE: "Pendiente",
  FACTURADO: "Facturado",
  ANULADO: "Anulado",
};

export const ETIQUETA_CONDICION_PAGO: Record<$Enums.CondicionPago, string> = {
  CONTADO: "Contado",
  DIAS_15: "Crédito 15 días",
  DIAS_30: "Crédito 30 días",
};

export const ETIQUETA_ESTADO_FACTURA: Record<$Enums.EstadoFactura, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

export const ETIQUETA_MEDIO_PAGO: Record<$Enums.MedioPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEPOSITO: "Depósito",
  YAPE: "Yape",
  PLIN: "Plin",
  OTRO: "Otro",
};

export const DIAS_CONDICION: Record<$Enums.CondicionPago, number> = {
  CONTADO: 0,
  DIAS_15: 15,
  DIAS_30: 30,
};
