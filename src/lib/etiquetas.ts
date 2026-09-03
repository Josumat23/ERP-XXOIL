import type { $Enums } from "@/generated/prisma/client";

// Prefijo que distingue, dentro del ledger de asignación de lote, una
// liberación por devolución física de una por anulación de factura.
// Vive acá (no en actions.ts) porque un archivo "use server" solo puede
// exportar funciones async — no puede exportar una constante de texto.
export const MOTIVO_DEVOLUCION_PREFIJO = "Devolución";

export const ETIQUETA_ORIGEN: Record<$Enums.OrigenMovimiento, string> = {
  STOCK_INICIAL: "Stock inicial",
  COMPRA: "Compra",
  PRODUCCION: "Producción",
  ENVASADO: "Envasado",
  VENTA: "Venta",
  ANULACION_VENTA: "Anulación de venta",
  REVERSO_ENTREGA: "Reverso de entrega",
  DEVOLUCION_CLIENTE: "Devolución de cliente",
  DEVOLUCION_PROVEEDOR: "Devolución a proveedor",
  TRASLADO: "Traslado entre almacenes",
  AJUSTE: "Ajuste",
};

export const ETIQUETA_ORIGEN_ASIENTO: Record<$Enums.OrigenAsiento, string> = {
  MANUAL: "Manual",
  VENTA: "Venta",
  SALIDA_MERCANCIA: "Salida de mercancías",
  DEVOLUCION_CLIENTE: "Devolución de cliente",
  COBRO: "Cobro",
  NOTA_CREDITO: "Nota de crédito",
  APLICACION_CREDITO_CLIENTE: "Aplicación de saldo a favor",
  REEMBOLSO_CLIENTE: "Reembolso a cliente",
  RECARGO_MORA: "Recargo por mora",
  ANULACION_VENTA: "Anulación de venta",
  COMPRA: "Compra",
  PAGO_PROVEEDOR: "Pago a proveedor",
  DEPRECIACION: "Depreciación",
  MANTENIMIENTO: "Mantenimiento",
  VENTA_ACTIVO_FIJO: "Venta de activo fijo",
  REVERSO: "Reverso",
  DEVOLUCION_COMPRA: "Devolución a proveedor",
  APLICACION_CREDITO_PROVEEDOR: "Aplicación de saldo de proveedor",
  REEMBOLSO_PROVEEDOR: "Reembolso de proveedor",
  PLANILLA: "Planilla",
  GRATIFICACION: "Gratificación",
  CTS: "CTS",
  LIQUIDACION: "Liquidación de desvinculación",
  ORDEN_INTERNA: "Orden interna",
  RECLASIFICACION_COSTO: "Reclasificación de costo entre centros",
  INICIO_PRODUCCION: "Inicio de producción",
  MANO_OBRA_PRODUCCION: "Mano de obra de producción",
  ENVASADO_PRODUCCION: "Transferencia a producto terminado",
  DESECHO_PRODUCCION: "Desecho de producción",
};

export const ETIQUETA_ESTADO_DESPACHO: Record<$Enums.EstadoDespacho, string> = {
  PLANIFICADO: "Planificado",
  EN_RUTA: "En ruta",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
};

export const ETIQUETA_ESTADO_LOTE: Record<$Enums.EstadoLote, string> = {
  PLANIFICADO: "Planificado",
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
  PARCIAL: "Facturación parcial",
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

export const ETIQUETA_ESTADO_SUNAT: Record<$Enums.EstadoEnvioSunat, string> = {
  PENDIENTE: "Pendiente de envío",
  ENVIADO: "Enviado, esperando confirmación",
  ACEPTADO: "Aceptado por SUNAT",
  RECHAZADO: "Rechazado por SUNAT",
  OBSERVADO: "Observado por SUNAT",
  ERROR: "Error al enviar",
};

export const COLOR_ESTADO_SUNAT: Record<$Enums.EstadoEnvioSunat, string> = {
  PENDIENTE: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  ENVIADO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  ACEPTADO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  RECHAZADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  OBSERVADO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};
