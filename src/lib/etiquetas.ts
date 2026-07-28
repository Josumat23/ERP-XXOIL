import type { $Enums } from "@/generated/prisma/client";

export const ETIQUETA_ORIGEN: Record<$Enums.OrigenMovimiento, string> = {
  STOCK_INICIAL: "Stock inicial",
  COMPRA: "Compra",
  PRODUCCION: "Producción",
  ENVASADO: "Envasado",
  VENTA: "Venta",
  ANULACION_VENTA: "Anulación de venta",
  DEVOLUCION_CLIENTE: "Devolución de cliente",
  TRASLADO: "Traslado entre almacenes",
  AJUSTE: "Ajuste",
};

export const ETIQUETA_ORIGEN_ASIENTO: Record<$Enums.OrigenAsiento, string> = {
  MANUAL: "Manual",
  VENTA: "Venta",
  COBRO: "Cobro",
  NOTA_CREDITO: "Nota de crédito",
  ANULACION_VENTA: "Anulación de venta",
  COMPRA: "Compra",
  PAGO_PROVEEDOR: "Pago a proveedor",
  DEPRECIACION: "Depreciación",
  MANTENIMIENTO: "Mantenimiento",
  VENTA_ACTIVO_FIJO: "Venta de activo fijo",
  REVERSO: "Reverso",
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

export const ETIQUETA_CANAL_CLIENTE: Record<$Enums.CanalCliente, string> = {
  DISTRIBUIDOR: "Distribuidor",
  MAYORISTA: "Mayorista",
  TALLER: "Taller",
  FLOTA: "Flota",
  MINERA_INDUSTRIA: "Minera / Industria",
  MINORISTA: "Minorista",
  OTRO: "Otro",
};

export const ETIQUETA_SEGMENTO_MERCADO: Record<$Enums.SegmentoMercado, string> = {
  AUTOMOTRIZ: "Automotriz",
  INDUSTRIAL: "Industrial",
  MINERO: "Minero",
  AGRICOLA: "Agrícola",
  MARINO: "Marino",
  OTRO: "Otro",
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

export const ETIQUETA_ESTADO_OC: Record<$Enums.EstadoOrdenCompra, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Recepción parcial",
  RECIBIDA: "Recibida",
  ANULADA: "Anulada",
};

export const ETIQUETA_ESTADO_HR: Record<$Enums.EstadoHojaRuta, string> = {
  PLANIFICADA: "Planificada",
  COMPLETADA: "Completada",
};

export const ETIQUETA_ESTADO_APROBACION: Record<$Enums.EstadoAprobacion, string> = {
  NO_REQUERIDA: "No requiere aprobación",
  PENDIENTE: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};
