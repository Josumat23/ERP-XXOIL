-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AlcanceAprobacionJerarquia" AS ENUM ('SIN_JERARQUIA', 'JEFE_DIRECTO', 'CADENA_MANDO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'ALMACEN', 'PRODUCCION', 'VENTAS', 'GERENCIA');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('NO_REQUERIDA', 'PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoPasoAprobacion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "AccionAuditoriaMaestro" AS ENUM ('CREAR', 'ACTUALIZAR', 'ACTIVAR', 'DESACTIVAR', 'ELIMINAR');

-- CreateEnum
CREATE TYPE "SegmentoMercado" AS ENUM ('AUTOMOTRIZ', 'INDUSTRIAL', 'MINERO', 'AGRICOLA', 'MARINO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoInsumo" AS ENUM ('MATERIA_PRIMA', 'ENVASE', 'ETIQUETA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCasco" AS ENUM ('ENTREGADO', 'DEVUELTO');

-- CreateEnum
CREATE TYPE "TipoItemKardex" AS ENUM ('PRESENTACION', 'INSUMO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "OrigenMovimiento" AS ENUM ('STOCK_INICIAL', 'COMPRA', 'PRODUCCION', 'ENVASADO', 'VENTA', 'ANULACION_VENTA', 'REVERSO_ENTREGA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR', 'TRASLADO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('PLANIFICADO', 'CANCELADO', 'EN_PROCESO', 'PENDIENTE_CALIDAD', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "DisposicionLoteRechazado" AS ENUM ('REPROCESADO', 'DESECHADO');

-- CreateEnum
CREATE TYPE "EstadoOperacionLote" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoMaterialProduccion" AS ENUM ('CONSUMO_ADICIONAL', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "ResultadoCalidad" AS ENUM ('APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoNoConformidad" AS ENUM ('ABIERTA', 'INVESTIGACION', 'IMPLEMENTACION', 'VERIFICACION', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('ABIERTO', 'EN_PROCESO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoAsignacionLote" AS ENUM ('ASIGNADA', 'LIBERADA');

-- CreateEnum
CREATE TYPE "TipoVendedor" AS ENUM ('CON_BASICO', 'SOLO_COMISION');

-- CreateEnum
CREATE TYPE "TipoCuentaBancaria" AS ENUM ('CORRIENTE', 'AHORROS');

-- CreateEnum
CREATE TYPE "EstadoRuc" AS ENUM ('ACTIVO', 'SUSPENSION_TEMPORAL', 'BAJA_PROVISIONAL', 'BAJA_DEFINITIVA', 'BAJA_DE_OFICIO');

-- CreateEnum
CREATE TYPE "CondicionRuc" AS ENUM ('HABIDO', 'NO_HABIDO', 'NO_HALLADO', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "PrioridadAtencion" AS ENUM ('ALTA', 'NORMAL', 'BAJA');

-- CreateEnum
CREATE TYPE "NivelRiesgoCliente" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "FrecuenciaReparto" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL', 'A_PEDIDO');

-- CreateEnum
CREATE TYPE "TipoDocumentoAdjunto" AS ENUM ('CONTRATO', 'FICHA_RUC', 'CONSTANCIA_BANCARIA', 'LICENCIA', 'CERTIFICADO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoDireccionCliente" AS ENUM ('FISCAL', 'FACTURACION', 'ENTREGA', 'COBRANZA');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "EstadoCliente" AS ENUM ('ACTIVO', 'BLOQUEADO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "CanalCliente" AS ENUM ('DISTRIBUIDOR', 'MAYORISTA', 'TALLER', 'FLOTA', 'MINERA_INDUSTRIA', 'MINORISTA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'PARCIAL', 'FACTURADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'CONVERTIDA');

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'DIAS_15', 'DIAS_30');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoComprobanteVenta" AS ENUM ('FACTURA', 'BOLETA');

-- CreateEnum
CREATE TYPE "EstadoAvisoCobranza" AS ENUM ('PENDIENTE', 'COMPROMISO_PAGO', 'EN_DISPUTA', 'SIN_RESPUESTA');

-- CreateEnum
CREATE TYPE "TipoComprobanteElectronico" AS ENUM ('FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'GUIA_REMISION');

-- CreateEnum
CREATE TYPE "EstadoEnvioSunat" AS ENUM ('PENDIENTE', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'OBSERVADO', 'ERROR');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'YAPE', 'PLIN', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoNotaCredito" AS ENUM ('ANULACION_OPERACION', 'ANULACION_ERROR_RUC', 'CORRECCION_DESCRIPCION', 'DESCUENTO_GLOBAL', 'DESCUENTO_ITEM', 'DEVOLUCION_TOTAL', 'DEVOLUCION_ITEM', 'BONIFICACION', 'DISMINUCION_VALOR', 'OTROS_CONCEPTOS');

-- CreateEnum
CREATE TYPE "TipoNotaDebito" AS ENUM ('INTERES_MORA', 'AUMENTO_VALOR', 'PENALIDAD_OTROS');

-- CreateEnum
CREATE TYPE "EstadoCreditoCliente" AS ENUM ('DISPONIBLE', 'AGOTADO');

-- CreateEnum
CREATE TYPE "EstadoDevolucionCliente" AS ENUM ('PENDIENTE_INSPECCION', 'CERRADA');

-- CreateEnum
CREATE TYPE "DecisionDevolucionCliente" AS ENUM ('PENDIENTE', 'REINGRESO_STOCK', 'DESECHO', 'DEVOLVER_CLIENTE', 'MIXTA');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('GENERADA', 'REVERSION');

-- CreateEnum
CREATE TYPE "EstadoComision" AS ENUM ('PENDIENTE', 'PAGADA');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('PENDIENTE', 'PARCIAL', 'RECIBIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoAcuerdoSuministro" AS ENUM ('ACTIVO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoRfqCompra" AS ENUM ('ABIERTO', 'ADJUDICADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoOfertaRfq" AS ENUM ('PRESENTADA', 'ADJUDICADA', 'NO_SELECCIONADA');

-- CreateEnum
CREATE TYPE "EstadoCreditoProveedor" AS ENUM ('DISPONIBLE', 'AGOTADO');

-- CreateEnum
CREATE TYPE "ResultadoInspeccion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoDespacho" AS ENUM ('PLANIFICADO', 'EN_RUTA', 'ENTREGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "ModalidadTransporte" AS ENUM ('PUBLICO', 'PRIVADO');

-- CreateEnum
CREATE TYPE "EstadoCampanaCertificacion" AS ENUM ('ABIERTA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DecisionCertificacion" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'REVOCADO');

-- CreateEnum
CREATE TYPE "TipoUnidadManipulacion" AS ENUM ('PALLET', 'CAJA', 'CONTENEDOR', 'JAULA');

-- CreateEnum
CREATE TYPE "EstadoUnidadManipulacion" AS ENUM ('EN_ALMACEN', 'EN_PLAYA', 'VACIA');

-- CreateEnum
CREATE TYPE "EstadoOleadaPicking" AS ENUM ('ABIERTA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoLicitacionFlete" AS ENUM ('ABIERTA', 'ADJUDICADA', 'DESIERTA');

-- CreateEnum
CREATE TYPE "EstadoOfertaFlete" AS ENUM ('PRESENTADA', 'ADJUDICADA', 'NO_SELECCIONADA');

-- CreateEnum
CREATE TYPE "EstadoCuentaPorPagar" AS ENUM ('PENDIENTE', 'PAGADA');

-- CreateEnum
CREATE TYPE "EstadoVerificacionFacturaProveedor" AS ENUM ('COINCIDE', 'BLOQUEADA', 'APROBADA_EXCEPCION');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "EstadoConciliacionBancaria" AS ENUM ('BORRADOR', 'CERRADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoHojaRuta" AS ENUM ('PLANIFICADA', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "TipoDocumentoSerie" AS ENUM ('FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'GUIA_REMISION');

-- CreateEnum
CREATE TYPE "TipoAlmacen" AS ENUM ('PLANTA', 'ALMACEN_DISTRIBUCION', 'ALMACEN_TRANSITO');

-- CreateEnum
CREATE TYPE "EstadoPeriodoFiscal" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO');

-- CreateEnum
CREATE TYPE "OrigenAsiento" AS ENUM ('MANUAL', 'VENTA', 'SALIDA_MERCANCIA', 'DEVOLUCION_CLIENTE', 'COBRO', 'NOTA_CREDITO', 'NOTA_DEBITO', 'APLICACION_CREDITO_CLIENTE', 'REEMBOLSO_CLIENTE', 'ANULACION_VENTA', 'RECARGO_MORA', 'COMPRA', 'PAGO_PROVEEDOR', 'DEPRECIACION', 'MANTENIMIENTO', 'VENTA_ACTIVO_FIJO', 'REVERSO', 'DEVOLUCION_COMPRA', 'APLICACION_CREDITO_PROVEEDOR', 'REEMBOLSO_PROVEEDOR', 'PLANILLA', 'GRATIFICACION', 'CTS', 'LIQUIDACION', 'ORDEN_INTERNA', 'RECLASIFICACION_COSTO', 'INICIO_PRODUCCION', 'MANO_OBRA_PRODUCCION', 'ENVASADO_PRODUCCION', 'DESECHO_PRODUCCION');

-- CreateEnum
CREATE TYPE "TipoCentroCosto" AS ENUM ('PRODUCCION', 'VENTAS', 'ADMINISTRACION', 'LOGISTICA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoOrdenInterna" AS ENUM ('ABIERTA', 'LIQUIDADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "CategoriaActivoFijo" AS ENUM ('MAQUINARIA', 'VEHICULO', 'EQUIPO_OFICINA', 'INMUEBLE', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('PLANIFICADO', 'EN_PROGRESO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoCentroTrabajo" AS ENUM ('MEZCLA', 'ENVASADO', 'CALIDAD', 'MANTENIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "FuenteLecturaContador" AS ENUM ('ALTA_EQUIPO', 'MANUAL', 'CIERRE_MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "TipoMantenimiento" AS ENUM ('PREVENTIVO', 'CORRECTIVO');

-- CreateEnum
CREATE TYPE "EstadoOrdenMantenimiento" AS ENUM ('PROGRAMADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CausaFallaMantenimiento" AS ENUM ('MECANICA', 'ELECTRICA', 'INSTRUMENTACION', 'LUBRICACION', 'OPERACION', 'OTRO');

-- CreateEnum
CREATE TYPE "PrioridadAvisoMantenimiento" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "EstadoAvisoMantenimiento" AS ENUM ('ABIERTO', 'CONVERTIDO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "TipoPlanMantenimiento" AS ENUM ('POR_TIEMPO', 'POR_CONTADOR');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('PLAZO_FIJO', 'PLAZO_INDETERMINADO', 'LOCACION_SERVICIOS');

-- CreateEnum
CREATE TYPE "EstadoEmpleado" AS ENUM ('ACTIVO', 'CESADO');

-- CreateEnum
CREATE TYPE "RegimenTributario" AS ENUM ('NRUS', 'RER', 'RMT', 'GENERAL');

-- CreateEnum
CREATE TYPE "TipoDocumentoIdentidad" AS ENUM ('DNI', 'PASAPORTE', 'CARNET_EXTRANJERIA', 'OTRO');

-- CreateEnum
CREATE TYPE "SistemaPension" AS ENUM ('ONP', 'AFP');

-- CreateEnum
CREATE TYPE "Afp" AS ENUM ('INTEGRA', 'PRIMA', 'HABITAT', 'PROFUTURO');

-- CreateEnum
CREATE TYPE "EstadoCambioSalarial" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoRegistroAsistencia" AS ENUM ('BORRADOR', 'APROBADO');

-- CreateEnum
CREATE TYPE "EstadoSolicitudVacaciones" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoPoliticaTiempo" AS ENUM ('BORRADOR', 'APROBADA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "TipoComisionAfp" AS ENUM ('FLUJO', 'MIXTA');

-- CreateEnum
CREATE TYPE "TipoPeriodoPlanilla" AS ENUM ('MENSUAL', 'GRATIFICACION_JULIO', 'GRATIFICACION_DICIEMBRE', 'CTS_MAYO', 'CTS_NOVIEMBRE');

-- CreateEnum
CREATE TYPE "EstadoPeriodoPlanilla" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "ClaveTareaProgramada" AS ENUM ('DEPRECIACION_MENSUAL', 'RECARGO_MORA', 'TIPO_CAMBIO_DIARIO', 'MANTENIMIENTO_PREVENTIVO', 'RESPALDO_BASE');

-- CreateEnum
CREATE TYPE "TipoDocumentoFiscal" AS ENUM ('RUC', 'DNI', 'CARNET_EXTRANJERIA', 'PASAPORTE', 'RUT', 'NIT', 'RFC', 'EIN', 'VAT', 'CI', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoDireccion" AS ENUM ('FACTURACION', 'ENVIO', 'OTRA');

-- CreateTable
CREATE TABLE "incidencias_contables" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "origen" "OrigenAsiento" NOT NULL,
    "glosa" TEXT NOT NULL,
    "referencia" TEXT,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "resueltoEn" TIMESTAMP(3),
    "resueltoPorId" TEXT,
    "resueltoPorNombre" TEXT,
    "notaResolucion" TEXT,

    CONSTRAINT "incidencias_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerrojo_correlativo" (
    "id" TEXT NOT NULL DEFAULT '1',
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cerrojo_correlativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_empresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL DEFAULT 'Mi Empresa S.A.C.',
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "ubigeoId" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "telefono" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tasaIgv" DECIMAL(65,30) NOT NULL DEFAULT 18,
    "representanteLegal" TEXT,
    "representanteLegalDocumento" TEXT,
    "regimenTributario" "RegimenTributario",
    "registroHidrocarburosOsinergmin" TEXT,
    "registroHidrocarburosVigencia" TIMESTAMP(3),
    "tasaRecargoMora" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tarifaHoraManoObra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montoAprobacionCompras" DECIMAL(65,30) NOT NULL DEFAULT 5000,
    "montoAprobacionPagos" DECIMAL(65,30) NOT NULL DEFAULT 5000,
    "montoAprobacionCredito" DECIMAL(65,30),
    "tasaDescuentoCxC" DECIMAL(65,30) NOT NULL DEFAULT 9,
    "tasaCreditoCortoPlazo" DECIMAL(65,30) NOT NULL DEFAULT 9,
    "limiteCreditoCortoPlazo" DECIMAL(65,30) NOT NULL DEFAULT 100000,
    "tasaCreditoLargoPlazo" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "oseProveedor" TEXT NOT NULL DEFAULT 'SIMULADO',
    "oseToken" TEXT,
    "sunatCertificadoBase64" TEXT,
    "sunatCertificadoPassword" TEXT,
    "sunatUsuarioSol" TEXT,
    "sunatClaveSol" TEXT,
    "alcanceAprobacionJerarquia" "AlcanceAprobacionJerarquia" NOT NULL DEFAULT 'CADENA_MANDO',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_bancarias_empresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "banco" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "numeroCuenta" TEXT NOT NULL,
    "cci" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cuentas_bancarias_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "grupoSeguridadId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntentoFallidoEn" TIMESTAMP(3),
    "bloqueadoHasta" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_maestros" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "entidad" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "accion" "AccionAuditoriaMaestro" NOT NULL,
    "valoresAntes" TEXT,
    "valoresDespues" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_maestros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "categoriaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedidaBase" TEXT NOT NULL DEFAULT 'kg',
    "segmentoMercado" "SegmentoMercado",
    "marca" TEXT,
    "gradoNlgi" TEXT,
    "viscosidad" TEXT,
    "vidaUtilMeses" INTEGER,
    "fichaTecnicaUrl" TEXT,
    "hojaSeguridadUrl" TEXT,
    "notasTecnicas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentaciones" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenidoKg" DECIMAL(65,30) NOT NULL,
    "contenidoLitros" DECIMAL(65,30),
    "unidadMedidaSunat" TEXT NOT NULL DEFAULT 'NIU',
    "precio" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stockReservado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "codigoBarras" TEXT,
    "pesoBrutoKg" DECIMAL(65,30),
    "unidadesPorCaja" INTEGER,
    "zonaAlmacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalones_precio" (
    "id" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidadMinima" INTEGER NOT NULL,
    "precio" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "escalones_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condiciones_comerciales_proveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteHasta" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condiciones_comerciales_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "tipoDocumentoFiscal" "TipoDocumentoFiscal" NOT NULL DEFAULT 'RUC',
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "ubigeoId" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "cuentaBancaria" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "esRetornable" BOOLEAN NOT NULL DEFAULT false,
    "montoDeposito" DECIMAL(65,30),
    "stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "plazoEntregaDias" INTEGER NOT NULL DEFAULT 0,
    "cantidadMinimaCompra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "multiploCompra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "codigoProveedor" TEXT,
    "zonaAlmacenId" TEXT,
    "notas" TEXT,
    "requiereInspeccion" BOOLEAN NOT NULL DEFAULT false,
    "esPeligroso" BOOLEAN NOT NULL DEFAULT false,
    "claseGhs" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_casco" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoCasco" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "movimientos_casco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_kardex" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "almacenId" TEXT NOT NULL,
    "tipoItem" "TipoItemKardex" NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "tipoMovimiento" "TipoMovimiento" NOT NULL,
    "origen" "OrigenMovimiento" NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "saldoAnterior" DECIMAL(65,30) NOT NULL,
    "saldoNuevo" DECIMAL(65,30) NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_kardex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_zona" (
    "id" TEXT NOT NULL,
    "zonaAlmacenId" TEXT NOT NULL,
    "tipoItem" "TipoItemKardex" NOT NULL,
    "itemId" TEXT NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_almacen" (
    "id" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "tipoItem" "TipoItemKardex" NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteos_inventario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "conteos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteo_inventario_detalles" (
    "id" TEXT NOT NULL,
    "conteoId" TEXT NOT NULL,
    "tipoItem" "TipoItemKardex" NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "cantidadSistema" DECIMAL(65,30) NOT NULL,
    "cantidadContada" DECIMAL(65,30) NOT NULL,
    "diferencia" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "conteo_inventario_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rendimientoKg" DECIMAL(65,30) NOT NULL,
    "horasEstandar" DECIMAL(65,30),
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_detalles" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "formula_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_operaciones" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "centroTrabajoId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "preparacionHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maquinaHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "manoObraHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "formula_operaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_granel" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "loteOrigenId" TEXT,
    "kgObjetivo" DECIMAL(65,30) NOT NULL,
    "kgProducidos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mermaKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "kgDisponibles" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoInsumos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoReproceso" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "horasManoObra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoEstandarInsumos" DECIMAL(65,30),
    "costoEstandarManoObra" DECIMAL(65,30),
    "costoEstandarTotal" DECIMAL(65,30),
    "costoEstandarPermitido" DECIMAL(65,30),
    "variacionInsumos" DECIMAL(65,30),
    "variacionManoObra" DECIMAL(65,30),
    "variacionRendimiento" DECIMAL(65,30),
    "variacionTotal" DECIMAL(65,30),
    "estado" "EstadoLote" NOT NULL DEFAULT 'EN_PROCESO',
    "observaciones" TEXT,
    "fechaCreacion" TIMESTAMP(3),
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLiberacion" TIMESTAMP(3),
    "usuarioLiberacionId" TEXT,
    "usuarioLiberacionNombre" TEXT,
    "fechaCancelacion" TIMESTAMP(3),
    "motivoCancelacion" TEXT,
    "usuarioCancelacionId" TEXT,
    "usuarioCancelacionNombre" TEXT,
    "fechaFin" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "disposicionRechazo" "DisposicionLoteRechazado",
    "motivoDisposicion" TEXT,
    "fechaDisposicion" TIMESTAMP(3),
    "usuarioDisposicionId" TEXT,
    "usuarioDisposicionNombre" TEXT,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "lotes_granel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_insumo_produccion" (
    "id" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_insumo_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_material_produccion" (
    "id" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoMaterialProduccion" NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL,
    "costoTotal" DECIMAL(65,30) NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_material_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_asignacion_lote_insumo" (
    "id" TEXT NOT NULL,
    "movimientoMaterialId" TEXT NOT NULL,
    "asignacionLoteInsumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_asignacion_lote_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_operaciones" (
    "id" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "formulaOperacionId" TEXT,
    "centroTrabajoId" TEXT NOT NULL,
    "equipoId" TEXT,
    "secuencia" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "preparacionPlanHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maquinaPlanHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "manoObraPlanHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "preparacionRealHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maquinaRealHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "manoObraRealHoras" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" "EstadoOperacionLote" NOT NULL DEFAULT 'PENDIENTE',
    "inicioEn" TIMESTAMP(3),
    "finEn" TIMESTAMP(3),
    "usuarioInicioId" TEXT,
    "usuarioInicioNombre" TEXT,
    "usuarioFinId" TEXT,
    "usuarioFinNombre" TEXT,
    "fechaPlanInicio" TIMESTAMP(3),
    "fechaPlanFin" TIMESTAMP(3),

    CONSTRAINT "lote_operaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controles_calidad" (
    "id" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "resultado" "ResultadoCalidad" NOT NULL,
    "observaciones" TEXT,
    "causaId" TEXT,
    "causaRaiz" TEXT,
    "accionCorrectiva" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "planInspeccionId" TEXT,
    "planVersion" INTEGER,

    CONSTRAINT "controles_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "no_conformidades_calidad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "controlCalidadId" TEXT NOT NULL,
    "estado" "EstadoNoConformidad" NOT NULL DEFAULT 'ABIERTA',
    "contencionInmediata" TEXT,
    "causaRaizConfirmada" TEXT,
    "accionCorrectiva" TEXT,
    "responsableId" TEXT,
    "responsableNombre" TEXT,
    "fechaCompromiso" TIMESTAMP(3),
    "verificacionEficacia" TEXT,
    "eficaz" BOOLEAN,
    "cerradoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "no_conformidades_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_no_conformidad_calidad" (
    "id" TEXT NOT NULL,
    "noConformidadId" TEXT NOT NULL,
    "estadoAnterior" "EstadoNoConformidad",
    "estadoNuevo" "EstadoNoConformidad" NOT NULL,
    "comentario" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_no_conformidad_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_inspeccion_calidad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_inspeccion_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caracteristicas_plan_calidad" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "limiteInferior" DECIMAL(65,30),
    "limiteSuperior" DECIMAL(65,30),
    "metodoEnsayo" TEXT,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "caracteristicas_plan_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_caracteristica_calidad" (
    "id" TEXT NOT NULL,
    "controlCalidadId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "limiteInferior" DECIMAL(65,30),
    "limiteSuperior" DECIMAL(65,30),
    "metodoEnsayo" TEXT,
    "valorMedido" DECIMAL(65,30) NOT NULL,
    "conforme" BOOLEAN NOT NULL,

    CONSTRAINT "resultados_caracteristica_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causas_calidad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "causas_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamos_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT,
    "causaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'ABIERTO',
    "accionCorrectiva" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envasados" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "unidadesDisponibles" INTEGER NOT NULL DEFAULT 0,
    "kgConsumidos" DECIMAL(65,30) NOT NULL,
    "horasManoObra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "envasados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_lote_venta" (
    "id" TEXT NOT NULL,
    "pedidoDetalleId" TEXT NOT NULL,
    "facturaDetalleId" TEXT,
    "guiaDetalleId" TEXT,
    "devolucionDetalleId" TEXT,
    "envasadoId" TEXT NOT NULL,
    "tipo" "TipoAsignacionLote" NOT NULL DEFAULT 'ASIGNADA',
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_lote_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envasado_insumos" (
    "id" TEXT NOT NULL,
    "envasadoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "envasado_insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendedores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tipo" "TipoVendedor" NOT NULL,
    "tasaComision" DECIMAL(65,30) NOT NULL,
    "zonaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoDireccionCliente" NOT NULL,
    "principalDe" "TipoDireccionCliente",
    "etiqueta" TEXT,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "ubigeoId" TEXT,
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "ventanaInicioMin" INTEGER,
    "ventanaFinMin" INTEGER,
    "recibeLunes" BOOLEAN NOT NULL DEFAULT true,
    "recibeMartes" BOOLEAN NOT NULL DEFAULT true,
    "recibeMiercoles" BOOLEAN NOT NULL DEFAULT true,
    "recibeJueves" BOOLEAN NOT NULL DEFAULT true,
    "recibeViernes" BOOLEAN NOT NULL DEFAULT true,
    "recibeSabado" BOOLEAN NOT NULL DEFAULT true,
    "recibeDomingo" BOOLEAN NOT NULL DEFAULT false,
    "requisitosEntrega" TEXT,
    "restriccionesVehiculares" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "latitud" DECIMAL(65,30),
    "longitud" DECIMAL(65,30),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direcciones_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "cargo" TEXT,
    "area" TEXT,
    "telefono" TEXT,
    "anexo" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "paraPedidos" BOOLEAN NOT NULL DEFAULT false,
    "paraFacturacion" BOOLEAN NOT NULL DEFAULT false,
    "paraCobranza" BOOLEAN NOT NULL DEFAULT false,
    "paraDespacho" BOOLEAN NOT NULL DEFAULT false,
    "esPrincipal" BOOLEAN,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_bancarias_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "tipoCuenta" "TipoCuentaBancaria" NOT NULL DEFAULT 'CORRIENTE',
    "numeroCuenta" TEXT NOT NULL,
    "cci" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "titular" TEXT,
    "esPrincipal" BOOLEAN,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_bancarias_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descuentos_canal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "canal" "CanalCliente" NOT NULL,
    "descuentoPct" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "descuentos_canal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_cambio_credito" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "limiteAnterior" DECIMAL(65,30),
    "limiteSolicitado" DECIMAL(65,30) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "solicitadoPorId" TEXT NOT NULL,
    "solicitadoPorNombre" TEXT NOT NULL,
    "solicitadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoPorId" TEXT,
    "resueltoPorNombre" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "motivoResolucion" TEXT,

    CONSTRAINT "solicitudes_cambio_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "tipoDocumentoFiscal" "TipoDocumentoFiscal" NOT NULL DEFAULT 'RUC',
    "documentoNormalizado" TEXT,
    "tipoPersona" "TipoPersona",
    "tipoContribuyente" TEXT,
    "estadoRuc" "EstadoRuc",
    "condicionRuc" "CondicionRuc",
    "rucConsultadoEn" TIMESTAMP(3),
    "rucFuenteConsulta" TEXT,
    "agenteRetencion" BOOLEAN NOT NULL DEFAULT false,
    "agentePercepcion" BOOLEAN NOT NULL DEFAULT false,
    "buenContribuyente" BOOLEAN NOT NULL DEFAULT false,
    "afectacionTributaria" TEXT,
    "canal" "CanalCliente",
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "ubigeoId" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "zonaId" TEXT,
    "vendedorId" TEXT,
    "almacenDespachoId" TEXT,
    "transportistaPreferidoId" TEXT,
    "frecuenciaReparto" "FrecuenciaReparto",
    "limiteCredito" DECIMAL(65,30) DEFAULT 0,
    "condicionPagoDefecto" "CondicionPago" NOT NULL DEFAULT 'CONTADO',
    "nivelRiesgo" "NivelRiesgoCliente",
    "motivoNivelRiesgo" TEXT,
    "toleranciaVencimientoDias" INTEGER,
    "requiereAprobacionCredito" BOOLEAN NOT NULL DEFAULT false,
    "descuentoGeneralPct" DECIMAL(65,30),
    "pedidoMinimo" DECIMAL(65,30),
    "prioridadAtencion" "PrioridadAtencion" NOT NULL DEFAULT 'NORMAL',
    "requiereOrdenCompra" BOOLEAN NOT NULL DEFAULT false,
    "monedaDefecto" TEXT NOT NULL DEFAULT 'PEN',
    "medioPagoPreferido" "MedioPago",
    "notas" TEXT,
    "estado" "EstadoCliente" NOT NULL DEFAULT 'ACTIVO',
    "motivoEstado" TEXT,
    "estadoDesde" TIMESTAMP(3),
    "estadoPorId" TEXT,
    "estadoPorNombre" TEXT,
    "bloqueadoCobranza" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoCobranzaEn" TIMESTAMP(3),
    "bloqueadoCobranzaPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validaHasta" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'PENDIENTE',
    "total" DECIMAL(65,30) NOT NULL,
    "probabilidad" INTEGER NOT NULL DEFAULT 50,
    "notas" TEXT,
    "pedidoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizacion_detalles" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "cotizacion_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntregaSolicitada" TIMESTAMP(3),
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "fulfillmentVersion" INTEGER NOT NULL DEFAULT 0,
    "requiereEntrega" BOOLEAN NOT NULL DEFAULT false,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "condicionPago" "CondicionPago" NOT NULL DEFAULT 'CONTADO',
    "direccionEntrega" TEXT,
    "direccionEntregaId" TEXT,
    "ordenCompraCliente" TEXT,
    "referenciaCliente" TEXT,
    "subtotalBruto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuentoTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "tasaIgv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalConIgv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacionCredito" "EstadoAprobacion" NOT NULL DEFAULT 'NO_REQUERIDA',
    "condicionPagoCredito" "CondicionPago",
    "deudaCreditoEvaluada" DECIMAL(65,30),
    "montoCreditoEvaluado" DECIMAL(65,30),
    "limiteCreditoEvaluado" DECIMAL(65,30),
    "creditoSolicitadoEn" TIMESTAMP(3),
    "creditoResueltoEn" TIMESTAMP(3),
    "creditoResueltoPor" TEXT,
    "motivoRechazoCredito" TEXT,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_detalles" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioLista" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "origenPrecio" TEXT NOT NULL DEFAULT 'LEGACY',
    "cantidadMinimaPrecio" INTEGER,
    "descuentoPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuentoMonto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "pedido_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "tipoComprobante" "TipoComprobanteVenta" NOT NULL DEFAULT 'FACTURA',
    "pedidoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "monedaFuncional" TEXT NOT NULL DEFAULT 'PEN',
    "condicionPago" "CondicionPago" NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tasaIgv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "saldo" DECIMAL(65,30) NOT NULL,
    "subtotalFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igvFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saldoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
    "motivoAnulacion" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "anuladaPor" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_detalles" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "pedidoDetalleId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioLista" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "origenPrecio" TEXT NOT NULL DEFAULT 'LEGACY',
    "cantidadMinimaPrecio" INTEGER,
    "descuentoPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuentoMonto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "precioUnitarioFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotalFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "factura_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recargos_mora" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diasCalculados" INTEGER NOT NULL,
    "tasaAplicada" DECIMAL(65,30) NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "recargos_mora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_cobranza" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "diasNivel2" INTEGER NOT NULL DEFAULT 15,
    "diasNivel3" INTEGER NOT NULL DEFAULT 30,
    "diasSinRespuesta" INTEGER,
    "diasGraciaCompromiso" INTEGER,
    "pausarEnDisputa" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT NOT NULL,
    "actualizadoPorNombre" TEXT NOT NULL,

    CONSTRAINT "politicas_cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_cobranza" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "diasVencidos" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estado" "EstadoAvisoCobranza" NOT NULL DEFAULT 'PENDIENTE',
    "compromisoPagoEn" TIMESTAMP(3),
    "detalleRespuesta" TEXT,
    "respondidoEn" TIMESTAMP(3),
    "respondidoPorId" TEXT,
    "respondidoPorNombre" TEXT,

    CONSTRAINT "avisos_cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_electronicos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipoDocumento" "TipoComprobanteElectronico" NOT NULL,
    "documentoId" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "estado" "EstadoEnvioSunat" NOT NULL DEFAULT 'PENDIENTE',
    "proveedorOse" TEXT NOT NULL,
    "codigoHash" TEXT,
    "sunatDescripcion" TEXT,
    "enlacePdf" TEXT,
    "enlaceXml" TEXT,
    "enlaceCdr" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntentoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_electronicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "facturaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cxcFuncionalAplicada" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "diferenciaCambio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "medioPago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_debito" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "recargoMoraId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseImponible" DECIMAL(65,30) NOT NULL,
    "igv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "afectoIgv" BOOLEAN NOT NULL DEFAULT false,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "tipoNota" "TipoNotaDebito" NOT NULL DEFAULT 'INTERES_MORA',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "notas_debito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_credito" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "tipoNota" "TipoNotaCredito" NOT NULL DEFAULT 'OTROS_CONCEPTOS',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "notas_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota_credito_detalles" (
    "id" TEXT NOT NULL,
    "notaCreditoId" TEXT NOT NULL,
    "pedidoDetalleId" TEXT NOT NULL,
    "devolucionDetalleId" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "nota_credito_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "notaCreditoId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambioOrigen" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoOriginal" DECIMAL(65,30) NOT NULL,
    "saldo" DECIMAL(65,30) NOT NULL,
    "montoFuncionalOriginal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saldoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" "EstadoCreditoCliente" NOT NULL DEFAULT 'DISPONIBLE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creditos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicaciones_credito_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(65,30) NOT NULL,
    "creditoFuncionalAplicado" DECIMAL(65,30) NOT NULL,
    "cxcFuncionalAplicada" DECIMAL(65,30) NOT NULL,
    "diferenciaCambio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "aplicaciones_credito_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reembolsos_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL(65,30) NOT NULL,
    "creditoFuncionalAplicado" DECIMAL(65,30) NOT NULL,
    "diferenciaCambio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "medioPago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadoPor" TEXT,
    "aprobadoEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "reembolsos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoDevolucionCliente" NOT NULL DEFAULT 'PENDIENTE_INSPECCION',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "cerradoEn" TIMESTAMP(3),
    "cerradoPorId" TEXT,
    "cerradoPorNombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_cliente_detalles" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "facturaDetalleId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "decision" "DecisionDevolucionCliente" NOT NULL DEFAULT 'PENDIENTE',
    "cantidadReingreso" INTEGER NOT NULL DEFAULT 0,
    "cantidadDesecho" INTEGER NOT NULL DEFAULT 0,
    "cantidadDevolverCliente" INTEGER NOT NULL DEFAULT 0,
    "cantidadAcreditable" INTEGER NOT NULL DEFAULT 0,
    "observacionCalidad" TEXT,
    "inspeccionadaEn" TIMESTAMP(3),
    "inspeccionadaPorId" TEXT,
    "inspeccionadaPorNombre" TEXT,

    CONSTRAINT "devolucion_cliente_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "vendedorId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "tipo" "TipoComision" NOT NULL,
    "tasa" DECIMAL(65,30) NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoComision" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acuerdos_suministro" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteHasta" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAcuerdoSuministro" NOT NULL DEFAULT 'ACTIVO',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acuerdos_suministro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acuerdo_suministro_lineas" (
    "id" TEXT NOT NULL,
    "acuerdoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidadComprometida" DECIMAL(65,30) NOT NULL,
    "cantidadLiberada" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "acuerdo_suministro_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_compras" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaLimite" TIMESTAMP(3),
    "estado" "EstadoRfqCompra" NOT NULL DEFAULT 'ABIERTO',
    "justificacionAdjudicacion" TEXT,
    "adjudicadaEn" TIMESTAMP(3),
    "adjudicadaPorId" TEXT,
    "adjudicadaPorNombre" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_compra_lineas" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "rfq_compra_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas_rfq" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "plazoEntregaDias" INTEGER NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoOfertaRfq" NOT NULL DEFAULT 'PRESENTADA',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofertas_rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferta_rfq_lineas" (
    "id" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "rfqLineaId" TEXT NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "oferta_rfq_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "total" DECIMAL(65,30) NOT NULL,
    "notas" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadaPor" TEXT,
    "aprobadaEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "proyectoId" TEXT,
    "edtId" TEXT,
    "rfqId" TEXT,
    "acuerdoId" TEXT,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveles_aprobacion_compra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoDesdePen" DECIMAL(65,30) NOT NULL,
    "rolAprobador" "RolUsuario" NOT NULL DEFAULT 'GERENCIA',
    "almacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "niveles_aprobacion_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasos_aprobacion_compra" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoDesdePen" DECIMAL(65,30) NOT NULL,
    "rolAprobador" "RolUsuario" NOT NULL,
    "estado" "EstadoPasoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "resueltoPorId" TEXT,
    "resueltoPorNombre" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasos_aprobacion_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_detalles" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "cantidadRecibida" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fechaEntregaEsperada" TIMESTAMP(3),
    "acuerdoLineaId" TEXT,

    CONSTRAINT "orden_compra_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones_compra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "recepciones_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepcion_compra_detalles" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL,
    "numeroLoteProveedor" TEXT,
    "cantidadDisponible" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "recepcion_compra_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_compra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "motivo" TEXT NOT NULL,
    "montoCredito" DECIMAL(65,30) NOT NULL,
    "montoFuncional" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_proveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT NOT NULL,
    "devolucionCompraId" TEXT NOT NULL,
    "montoFuncionalOriginal" DECIMAL(65,30) NOT NULL,
    "saldoFuncional" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoCreditoProveedor" NOT NULL DEFAULT 'DISPONIBLE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creditos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicaciones_credito_proveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "cuentaPorPagarId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoFuncional" DECIMAL(65,30) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "aplicaciones_credito_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reembolsos_proveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoFuncional" DECIMAL(65,30) NOT NULL,
    "medioPago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "reembolsos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_lote_insumo" (
    "id" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_lote_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspecciones_compra" (
    "id" TEXT NOT NULL,
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "resultado" "ResultadoInspeccion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "fecha" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planInspeccionId" TEXT,
    "planVersion" INTEGER,

    CONSTRAINT "inspecciones_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_inspeccion_insumo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "insumoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_inspeccion_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caracteristicas_plan_insumo" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "limiteInferior" DECIMAL(65,30),
    "limiteSuperior" DECIMAL(65,30),
    "metodoEnsayo" TEXT,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "caracteristicas_plan_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mediciones_inspeccion_compra" (
    "id" TEXT NOT NULL,
    "inspeccionCompraId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "limiteInferior" DECIMAL(65,30),
    "limiteSuperior" DECIMAL(65,30),
    "metodoEnsayo" TEXT,
    "valorMedido" DECIMAL(65,30) NOT NULL,
    "conforme" BOOLEAN NOT NULL,

    CONSTRAINT "mediciones_inspeccion_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanas_certificacion_accesos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "estado" "EstadoCampanaCertificacion" NOT NULL DEFAULT 'ABIERTA',
    "notas" TEXT,
    "abiertaPorId" TEXT NOT NULL,
    "abiertaPorNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" TIMESTAMP(3),
    "completadaPorId" TEXT,
    "completadaPorNombre" TEXT,
    "motivoCancelacion" TEXT,

    CONSTRAINT "campanas_certificacion_accesos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificaciones_acceso" (
    "id" TEXT NOT NULL,
    "campanaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "grupoNombre" TEXT,
    "permisosResumen" TEXT NOT NULL,
    "conflictosSod" TEXT,
    "ultimoAccesoEn" TIMESTAMP(3),
    "decision" "DecisionCertificacion" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "revisadoPorId" TEXT,
    "revisadoPorNombre" TEXT,
    "revisadoEn" TIMESTAMP(3),

    CONSTRAINT "certificaciones_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_manipulacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "tipo" "TipoUnidadManipulacion" NOT NULL DEFAULT 'PALLET',
    "zonaAlmacenId" TEXT,
    "estado" "EstadoUnidadManipulacion" NOT NULL DEFAULT 'EN_ALMACEN',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_manipulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidad_manipulacion_contenidos" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "unidad_manipulacion_contenidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oleadas_picking" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "estado" "EstadoOleadaPicking" NOT NULL DEFAULT 'ABIERTA',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" TIMESTAMP(3),
    "completadaPorId" TEXT,
    "completadaPorNombre" TEXT,
    "motivoCancelacion" TEXT,

    CONSTRAINT "oleadas_picking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oleada_picking_guias" (
    "id" TEXT NOT NULL,
    "oleadaId" TEXT NOT NULL,
    "guiaId" TEXT NOT NULL,

    CONSTRAINT "oleada_picking_guias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_lineas" (
    "id" TEXT NOT NULL,
    "oleadaId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidadRequerida" DECIMAL(65,30) NOT NULL,
    "cantidadPickeada" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "picking_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitaciones_flete" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "ubigeoOrigenId" TEXT,
    "ubigeoDestinoId" TEXT,
    "fechaRequerida" TIMESTAMP(3) NOT NULL,
    "pesoEstimadoKg" DECIMAL(65,30) NOT NULL,
    "fechaLimite" TIMESTAMP(3),
    "notas" TEXT,
    "estado" "EstadoLicitacionFlete" NOT NULL DEFAULT 'ABIERTA',
    "justificacionAdjudicacion" TEXT,
    "motivoDesierta" TEXT,
    "adjudicadaEn" TIMESTAMP(3),
    "adjudicadaPorId" TEXT,
    "adjudicadaPorNombre" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licitaciones_flete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas_flete" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "diasTransito" INTEGER NOT NULL,
    "validaHasta" TIMESTAMP(3),
    "notas" TEXT,
    "estado" "EstadoOfertaFlete" NOT NULL DEFAULT 'PRESENTADA',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofertas_flete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportistas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "registroMtc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transportistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportista_vehiculos" (
    "id" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "transportista_vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportista_conductores" (
    "id" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "licencia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "transportista_conductores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_remision" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "pedidoId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" TIMESTAMP(3) NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "ubigeoPartidaId" TEXT,
    "ubigeoLlegadaId" TEXT,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "pesoBrutoTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "modalidadTransporte" "ModalidadTransporte" NOT NULL DEFAULT 'PRIVADO',
    "transportistaId" TEXT,
    "licitacionFleteId" TEXT,
    "transportista" TEXT,
    "transportistaRuc" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "equipoId" TEXT,
    "estadoDespacho" "EstadoDespacho" NOT NULL DEFAULT 'PLANIFICADO',
    "fechaSalida" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "anuladaEn" TIMESTAMP(3),
    "anuladaPorId" TEXT,
    "anuladaPorNombre" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guias_remision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubigeos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,

    CONSTRAINT "ubigeos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guia_remision_detalles" (
    "id" TEXT NOT NULL,
    "guiaId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "pedidoDetalleId" TEXT,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "guia_remision_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_detalle_entregas" (
    "id" TEXT NOT NULL,
    "facturaDetalleId" TEXT NOT NULL,
    "guiaDetalleId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "factura_detalle_entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_por_pagar" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT NOT NULL,
    "ordenCompraId" TEXT,
    "recepcionCompraId" TEXT,
    "numeroDocumento" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL DEFAULT '01',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "total" DECIMAL(65,30) NOT NULL,
    "saldo" DECIMAL(65,30) NOT NULL,
    "montoOriginal" DECIMAL(65,30),
    "monedaOriginal" TEXT,
    "tipoCambio" DECIMAL(65,30),
    "discrepanciaPrecioPct" DECIMAL(65,30),
    "estadoVerificacion" "EstadoVerificacionFacturaProveedor" NOT NULL DEFAULT 'COINCIDE',
    "verificacionResueltaPorId" TEXT,
    "verificacionResueltaPorNombre" TEXT,
    "verificacionResueltaEn" TIMESTAMP(3),
    "motivoExcepcion" TEXT,
    "estado" "EstadoCuentaPorPagar" NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "cuentas_por_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_proveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "cuentaPorPagarId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(65,30) NOT NULL,
    "medioPago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadoPor" TEXT,
    "aprobadoEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,

    CONSTRAINT "pagos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "montoOriginal" DECIMAL(65,30),
    "medioPago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "cuentaBancariaId" TEXT,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliaciones_bancarias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "cuentaBancariaId" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "saldoInicialExtracto" DECIMAL(65,30) NOT NULL,
    "saldoFinalExtracto" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoConciliacionBancaria" NOT NULL DEFAULT 'BORRADOR',
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorId" TEXT,
    "cerradaPorNombre" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "anuladaPorId" TEXT,
    "anuladaPorNombre" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliaciones_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_extracto_bancario" (
    "id" TEXT NOT NULL,
    "conciliacionId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "referencia" TEXT,
    "monto" DECIMAL(65,30) NOT NULL,
    "huella" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_extracto_bancario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliaciones_bancarias_aplicaciones" (
    "id" TEXT NOT NULL,
    "movimientoExtractoId" TEXT NOT NULL,
    "movimientoCajaId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliaciones_bancarias_aplicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hojas_ruta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoHojaRuta" NOT NULL DEFAULT 'PLANIFICADA',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hojas_ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hoja_ruta_visitas" (
    "id" TEXT NOT NULL,
    "hojaRutaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "objetivo" TEXT,
    "resultado" TEXT,

    CONSTRAINT "hoja_ruta_visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_documento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipoDocumento" "TipoDocumentoSerie" NOT NULL,
    "serie" TEXT NOT NULL,
    "correlativoActual" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacenes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipo" "TipoAlmacen" NOT NULL DEFAULT 'ALMACEN_DISTRIBUCION',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "ubigeoId" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "encargado" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendarios_produccion" (
    "id" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "horasLunes" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "horasMartes" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "horasMiercoles" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "horasJueves" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "horasViernes" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "horasSabado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "horasDomingo" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "calendarios_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dias_no_laborables" (
    "id" TEXT NOT NULL,
    "calendarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "dias_no_laborables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas_almacen" (
    "id" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT,
    "parentId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "zonas_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clases_unidad_medida" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clases_unidad_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_medida" (
    "id" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_seguridad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPredefinido" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_seguridad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos_grupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "puedeVer" BOOLEAN NOT NULL DEFAULT true,
    "puedeCrear" BOOLEAN NOT NULL DEFAULT false,
    "puedeEditar" BOOLEAN NOT NULL DEFAULT false,
    "puedeAprobar" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "permisos_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_cierre_periodo" (
    "id" TEXT NOT NULL,
    "periodoFiscalId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "completadaEn" TIMESTAMP(3),
    "completadaPorId" TEXT,
    "completadaPorNombre" TEXT,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_cierre_periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_fiscales" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" "EstadoPeriodoFiscal" NOT NULL DEFAULT 'ABIERTO',
    "cerradoEn" TIMESTAMP(3),
    "cerradoPor" TEXT,
    "pendientesAlCerrar" INTEGER,

    CONSTRAINT "periodos_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_cuentas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esMaestro" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_contables" (
    "id" TEXT NOT NULL,
    "planCuentasId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libros" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "libros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos_contables" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "libroId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "origen" "OrigenAsiento" NOT NULL DEFAULT 'MANUAL',
    "glosa" TEXT NOT NULL,
    "referencia" TEXT,
    "reversadoPor" TEXT,
    "reversaA" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asiento_detalles" (
    "id" TEXT NOT NULL,
    "asientoId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "glosa" TEXT,
    "debe" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "haber" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "asiento_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controles_contables" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clave" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,

    CONSTRAINT "controles_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_costo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCentroCosto" NOT NULL,
    "almacenId" TEXT,
    "parentId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centros_costo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos_centro_costo" (
    "id" TEXT NOT NULL,
    "centroCostoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "montoPresupuestado" DECIMAL(65,30) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presupuestos_centro_costo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_internas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "presupuesto" DECIMAL(65,30),
    "totalAcumulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estado" "EstadoOrdenInterna" NOT NULL DEFAULT 'ABIERTA',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLiquidacion" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_internas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_interna_costos" (
    "id" TEXT NOT NULL,
    "ordenInternaId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "orden_interna_costos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_asignacion_costo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglas_asignacion_costo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_asignacion_costo_detalles" (
    "id" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,
    "centroCostoId" TEXT NOT NULL,
    "porcentaje" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "reglas_asignacion_costo_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centro_costo_controles" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clave" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "reglaId" TEXT,

    CONSTRAINT "centro_costo_controles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activos_fijos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaActivoFijo" NOT NULL,
    "almacenId" TEXT,
    "fechaAdquisicion" TIMESTAMP(3) NOT NULL,
    "costoAdquisicion" DECIMAL(65,30) NOT NULL,
    "valorResidual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vidaUtilAnios" INTEGER NOT NULL,
    "depreciacionAcumulada" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" TIMESTAMP(3),
    "motivoBaja" TEXT,
    "precioVenta" DECIMAL(65,30),
    "notas" TEXT,
    "centroCostoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proyectoId" TEXT,

    CONSTRAINT "activos_fijos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciaciones_activo" (
    "id" TEXT NOT NULL,
    "activoFijoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciaciones_activo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "centroCostoId" TEXT,
    "presupuestoTotal" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'PLANIFICADO',
    "fechaInicioPlan" TIMESTAMP(3) NOT NULL,
    "fechaFinPlan" TIMESTAMP(3) NOT NULL,
    "fechaInicioReal" TIMESTAMP(3),
    "fechaFinReal" TIMESTAMP(3),
    "responsableId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edt_proyecto" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "parentId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "presupuesto" DECIMAL(65,30),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "edt_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades_proyecto" (
    "id" TEXT NOT NULL,
    "edtId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionDias" INTEGER NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'PLANIFICADO',
    "responsableId" TEXT,
    "equipoId" TEXT,
    "fechaInicioPlan" TIMESTAMP(3),
    "fechaFinPlan" TIMESTAMP(3),
    "esCritica" BOOLEAN NOT NULL DEFAULT false,
    "holguraDias" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "actividades_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precedencias_actividad" (
    "id" TEXT NOT NULL,
    "actividadPredecesoraId" TEXT NOT NULL,
    "actividadSucesoraId" TEXT NOT NULL,

    CONSTRAINT "precedencias_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costos_proyecto" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "edtId" TEXT,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "costos_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_trabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCentroTrabajo" NOT NULL,
    "almacenId" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "capacidadHorasDia" DECIMAL(65,30) NOT NULL,
    "eficienciaPct" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centros_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones_tecnicas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentId" TEXT,
    "almacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "activoFijoId" TEXT,
    "centroCostoId" TEXT,
    "centroTrabajoId" TEXT,
    "ubicacionTecnicaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "contadorActual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unidadContador" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturas_contador_equipo" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "fuente" "FuenteLecturaContador" NOT NULL,
    "observacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecturas_contador_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_mantenimiento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "tipo" "TipoMantenimiento" NOT NULL,
    "estado" "EstadoOrdenMantenimiento" NOT NULL DEFAULT 'PROGRAMADA',
    "descripcion" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "duracionDias" INTEGER NOT NULL DEFAULT 1,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "costoManoObra" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoRepuestos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "modoFalla" TEXT,
    "causaFalla" "CausaFallaMantenimiento",
    "tiempoParadaHoras" DECIMAL(65,30),
    "tecnicoResponsable" TEXT,
    "centroCostoId" TEXT,
    "planMantenimientoId" TEXT,
    "avisoMantenimientoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_mantenimiento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "equipoId" TEXT NOT NULL,
    "prioridad" "PrioridadAvisoMantenimiento" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoAvisoMantenimiento" NOT NULL DEFAULT 'ABIERTO',
    "titulo" TEXT NOT NULL,
    "sintoma" TEXT NOT NULL,
    "equipoDetenido" BOOLEAN NOT NULL DEFAULT false,
    "fechaDeteccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descartadoEn" TIMESTAMP(3),
    "motivoDescarte" TEXT,

    CONSTRAINT "avisos_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_mantenimiento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPlanMantenimiento" NOT NULL,
    "frecuenciaDias" INTEGER,
    "frecuenciaContador" DECIMAL(65,30),
    "ultimaEjecucionFecha" TIMESTAMP(3),
    "ultimaEjecucionContador" DECIMAL(65,30),
    "centroCostoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repuestos_plan_mantenimiento" (
    "id" TEXT NOT NULL,
    "planMantenimientoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repuestos_plan_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repuestos_orden_mantenimiento" (
    "id" TEXT NOT NULL,
    "ordenMantenimientoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "costoUnitario" DECIMAL(65,30) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repuestos_orden_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecciones" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "anioBase" INTEGER NOT NULL,
    "trimestreBase" INTEGER NOT NULL,
    "crecimientoMercadoPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "factorCompetenciaPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "presupuestoPublicidad" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cajaMinimaDeseada" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metaUtilidadOperativa" DECIMAL(65,30),
    "macroPbiManufacturaVar" DECIMAL(65,30),
    "macroInflacionVar" DECIMAL(65,30),
    "macroTipoCambio" DECIMAL(65,30),
    "macroActualizadoEn" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyecciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyeccion_detalles" (
    "id" TEXT NOT NULL,
    "proyeccionId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "ventasBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "indiceEstacionalidad" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "ajusteCualitativoPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "demandaProyectada" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "precioSimulado" DECIMAL(65,30),
    "precioCompetidorRef" DECIMAL(65,30),

    CONSTRAINT "proyeccion_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_cambio" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'BCRP',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posiciones_organizativas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "reportaAId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posiciones_organizativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_posicion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "posicionId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteHasta" TIMESTAMP(3),
    "motivo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_posicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "tipoDocumentoIdentidad" "TipoDocumentoIdentidad" NOT NULL DEFAULT 'DNI',
    "dni" TEXT,
    "nacionalidad" TEXT NOT NULL DEFAULT 'Peruana',
    "fechaNacimiento" TIMESTAMP(3),
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "fechaCese" TIMESTAMP(3),
    "motivoCese" TEXT,
    "cargo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "tipoContrato" "TipoContrato" NOT NULL,
    "sueldoBasico" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "telefono" TEXT,
    "correo" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "almacenId" TEXT,
    "centroCostoId" TEXT,
    "usuarioId" TEXT,
    "estado" "EstadoEmpleado" NOT NULL DEFAULT 'ACTIVO',
    "sistemaPension" "SistemaPension",
    "afp" "Afp",
    "asignacionFamiliar" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnoTrabajoId" TEXT,
    "jefeDirectoId" TEXT,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cambios_salariales" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "sueldoAnterior" DECIMAL(65,30) NOT NULL,
    "sueldoNuevo" DECIMAL(65,30) NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoCambioSalarial" NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "resueltoEn" TIMESTAMP(3),
    "resueltoPorId" TEXT,
    "resueltoPorNombre" TEXT,
    "motivoRechazo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambios_salariales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_trabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "finMinuto" INTEGER NOT NULL,
    "refrigerioMinuto" INTEGER NOT NULL DEFAULT 60,
    "toleranciaMinuto" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_asistencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "empleadoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "entrada" TIMESTAMP(3),
    "salida" TIMESTAMP(3),
    "minutosTrabajados" INTEGER NOT NULL DEFAULT 0,
    "minutosTardanza" INTEGER NOT NULL DEFAULT 0,
    "minutosSobretiempo" INTEGER NOT NULL DEFAULT 0,
    "ausenciaJustificada" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "estado" "EstadoRegistroAsistencia" NOT NULL DEFAULT 'BORRADOR',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "aprobadoEn" TIMESTAMP(3),
    "aprobadoPorId" TEXT,
    "aprobadoPorNombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_vacaciones" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "diasSolicitados" INTEGER NOT NULL,
    "estado" "EstadoSolicitudVacaciones" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "aprobadaPor" TEXT,
    "aprobadaEn" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_vacaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_planilla" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "rmv" DECIMAL(65,30) NOT NULL,
    "uit" DECIMAL(65,30) NOT NULL,
    "tasaEsSalud" DECIMAL(65,30) NOT NULL DEFAULT 9,
    "tasaOnp" DECIMAL(65,30) NOT NULL DEFAULT 13,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametros_planilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_tiempo_trabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "horasJornadaDiaria" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "primerasHorasRecargo" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "recargoPrimerTramo" DECIMAL(65,30) NOT NULL DEFAULT 25,
    "recargoSegundoTramo" DECIMAL(65,30) NOT NULL DEFAULT 35,
    "aplicarPagoSobretiempo" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoPoliticaTiempo" NOT NULL DEFAULT 'BORRADOR',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "aprobadoEn" TIMESTAMP(3),
    "aprobadoPorId" TEXT,
    "aprobadoPorNombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "politicas_tiempo_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasas_afp" (
    "id" TEXT NOT NULL,
    "afp" "Afp" NOT NULL,
    "tipoComision" "TipoComisionAfp" NOT NULL DEFAULT 'FLUJO',
    "tasaAporteObligatorio" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "tasaComision" DECIMAL(65,30) NOT NULL,
    "primaSeguro" DECIMAL(65,30) NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasas_afp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planilla_periodos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tipo" "TipoPeriodoPlanilla" NOT NULL DEFAULT 'MENSUAL',
    "estado" "EstadoPeriodoPlanilla" NOT NULL DEFAULT 'ABIERTO',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "planilla_periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planilla_detalles" (
    "id" TEXT NOT NULL,
    "planillaPeriodoId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "sueldoBasico" DECIMAL(65,30) NOT NULL,
    "asignacionFamiliar" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remuneracionComputable" DECIMAL(65,30) NOT NULL,
    "descuentoPension" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "detallePension" TEXT,
    "essaludPatronal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "retencion5ta" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "diasAsistenciaAprobada" INTEGER NOT NULL DEFAULT 0,
    "diasAusenciaJustificada" INTEGER NOT NULL DEFAULT 0,
    "minutosTardanza" INTEGER NOT NULL DEFAULT 0,
    "minutosSobretiempo" INTEGER NOT NULL DEFAULT 0,
    "importeSobretiempo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "politicaTiempoTrabajoId" TEXT,
    "mesesComputados" DECIMAL(65,30),
    "bonificacionExtraordinaria" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "neto" DECIMAL(65,30) NOT NULL,
    "asientoNumero" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planilla_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones_desvinculacion" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fechaCese" TIMESTAMP(3) NOT NULL,
    "ctsTruncada" DECIMAL(65,30) NOT NULL,
    "gratificacionTruncada" DECIMAL(65,30) NOT NULL,
    "bonificacionExtraordinaria" DECIMAL(65,30) NOT NULL,
    "diasVacacionesPendientes" DECIMAL(65,30) NOT NULL,
    "montoVacaciones" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "asientoNumero" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_desvinculacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "tipoDocumento" "TipoDocumentoAdjunto",
    "venceEl" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_programadas" (
    "id" TEXT NOT NULL,
    "clave" "ClaveTareaProgramada" NOT NULL,
    "ejecutadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitoso" BOOLEAN NOT NULL,
    "resumen" TEXT NOT NULL,

    CONSTRAINT "tareas_programadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "tipo" "TipoDireccion" NOT NULL DEFAULT 'OTRA',
    "pais" TEXT NOT NULL,
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "direccion" TEXT NOT NULL,
    "codigoPostal" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos" (
    "id" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "monedaFuncional" TEXT NOT NULL DEFAULT 'PEN',
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidencias_contables_empresaId_resueltoEn_fecha_idx" ON "incidencias_contables"("empresaId", "resueltoEn", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_empresa_empresaId_key" ON "configuracion_empresa"("empresaId");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_empresa_empresaId_numeroCuenta_idx" ON "cuentas_bancarias_empresa"("empresaId", "numeroCuenta");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empresaId_usuario_key" ON "usuarios"("empresaId", "usuario");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_key" ON "sesiones"("token");

-- CreateIndex
CREATE INDEX "auditoria_maestros_empresaId_entidad_registroId_creadoEn_idx" ON "auditoria_maestros"("empresaId", "entidad", "registroId", "creadoEn");

-- CreateIndex
CREATE INDEX "auditoria_maestros_usuarioId_creadoEn_idx" ON "auditoria_maestros"("usuarioId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_empresaId_nombre_key" ON "categorias"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_empresaId_codigo_key" ON "productos"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "presentaciones_empresaId_sku_key" ON "presentaciones"("empresaId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "escalones_precio_presentacionId_cantidadMinima_key" ON "escalones_precio"("presentacionId", "cantidadMinima");

-- CreateIndex
CREATE INDEX "condiciones_comerciales_proveedor_proveedorId_vigenteDesde_idx" ON "condiciones_comerciales_proveedor"("proveedorId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_empresaId_ruc_key" ON "proveedores"("empresaId", "ruc");

-- CreateIndex
CREATE UNIQUE INDEX "insumos_empresaId_codigo_key" ON "insumos"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "movimientos_casco_empresaId_clienteId_insumoId_idx" ON "movimientos_casco"("empresaId", "clienteId", "insumoId");

-- CreateIndex
CREATE INDEX "movimientos_kardex_tipoItem_presentacionId_insumoId_idx" ON "movimientos_kardex"("tipoItem", "presentacionId", "insumoId");

-- CreateIndex
CREATE INDEX "movimientos_kardex_almacenId_tipoItem_presentacionId_insumo_idx" ON "movimientos_kardex"("almacenId", "tipoItem", "presentacionId", "insumoId");

-- CreateIndex
CREATE INDEX "saldos_zona_presentacionId_idx" ON "saldos_zona"("presentacionId");

-- CreateIndex
CREATE INDEX "saldos_zona_insumoId_idx" ON "saldos_zona"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_zona_zonaAlmacenId_itemId_key" ON "saldos_zona"("zonaAlmacenId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_almacen_almacenId_tipoItem_presentacionId_insumoId_key" ON "saldos_almacen"("almacenId", "tipoItem", "presentacionId", "insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "conteos_inventario_empresaId_codigo_key" ON "conteos_inventario"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "formulas_productoId_version_key" ON "formulas"("productoId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "formula_operaciones_formulaId_secuencia_key" ON "formula_operaciones"("formulaId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_granel_empresaId_codigo_key" ON "lotes_granel"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "reservas_insumo_produccion_insumoId_idx" ON "reservas_insumo_produccion"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_insumo_produccion_loteGranelId_insumoId_key" ON "reservas_insumo_produccion"("loteGranelId", "insumoId");

-- CreateIndex
CREATE INDEX "movimientos_material_produccion_loteGranelId_creadoEn_idx" ON "movimientos_material_produccion"("loteGranelId", "creadoEn");

-- CreateIndex
CREATE INDEX "devoluciones_asignacion_lote_insumo_asignacionLoteInsumoId_idx" ON "devoluciones_asignacion_lote_insumo"("asignacionLoteInsumoId");

-- CreateIndex
CREATE INDEX "lote_operaciones_centroTrabajoId_estado_idx" ON "lote_operaciones"("centroTrabajoId", "estado");

-- CreateIndex
CREATE INDEX "lote_operaciones_fechaPlanInicio_fechaPlanFin_idx" ON "lote_operaciones"("fechaPlanInicio", "fechaPlanFin");

-- CreateIndex
CREATE UNIQUE INDEX "lote_operaciones_loteGranelId_secuencia_key" ON "lote_operaciones"("loteGranelId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "controles_calidad_loteGranelId_key" ON "controles_calidad"("loteGranelId");

-- CreateIndex
CREATE UNIQUE INDEX "no_conformidades_calidad_controlCalidadId_key" ON "no_conformidades_calidad"("controlCalidadId");

-- CreateIndex
CREATE INDEX "no_conformidades_calidad_empresaId_estado_fechaCompromiso_idx" ON "no_conformidades_calidad"("empresaId", "estado", "fechaCompromiso");

-- CreateIndex
CREATE INDEX "eventos_no_conformidad_calidad_noConformidadId_creadoEn_idx" ON "eventos_no_conformidad_calidad"("noConformidadId", "creadoEn");

-- CreateIndex
CREATE INDEX "planes_inspeccion_calidad_empresaId_activo_idx" ON "planes_inspeccion_calidad"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "planes_inspeccion_calidad_productoId_version_key" ON "planes_inspeccion_calidad"("productoId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "caracteristicas_plan_calidad_planId_secuencia_key" ON "caracteristicas_plan_calidad"("planId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_caracteristica_calidad_controlCalidadId_secuenci_key" ON "resultados_caracteristica_calidad"("controlCalidadId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "causas_calidad_empresaId_nombre_key" ON "causas_calidad"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "reclamos_cliente_empresaId_numero_key" ON "reclamos_cliente"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "envasados_empresaId_codigo_key" ON "envasados"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "asignaciones_lote_venta_facturaDetalleId_idx" ON "asignaciones_lote_venta"("facturaDetalleId");

-- CreateIndex
CREATE INDEX "asignaciones_lote_venta_guiaDetalleId_idx" ON "asignaciones_lote_venta"("guiaDetalleId");

-- CreateIndex
CREATE INDEX "asignaciones_lote_venta_devolucionDetalleId_idx" ON "asignaciones_lote_venta"("devolucionDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_empresaId_nombre_key" ON "zonas"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "direcciones_cliente_clienteId_tipo_idx" ON "direcciones_cliente"("clienteId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "direcciones_cliente_clienteId_principalDe_key" ON "direcciones_cliente"("clienteId", "principalDe");

-- CreateIndex
CREATE INDEX "contactos_cliente_clienteId_activo_idx" ON "contactos_cliente"("clienteId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_cliente_clienteId_esPrincipal_key" ON "contactos_cliente"("clienteId", "esPrincipal");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_cliente_clienteId_activa_idx" ON "cuentas_bancarias_cliente"("clienteId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_bancarias_cliente_clienteId_esPrincipal_key" ON "cuentas_bancarias_cliente"("clienteId", "esPrincipal");

-- CreateIndex
CREATE UNIQUE INDEX "descuentos_canal_empresaId_canal_key" ON "descuentos_canal"("empresaId", "canal");

-- CreateIndex
CREATE INDEX "solicitudes_cambio_credito_empresaId_estado_solicitadoEn_idx" ON "solicitudes_cambio_credito"("empresaId", "estado", "solicitadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_empresaId_documentoNormalizado_key" ON "clientes"("empresaId", "documentoNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_pedidoId_key" ON "cotizaciones"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_empresaId_numero_key" ON "cotizaciones"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_empresaId_numero_key" ON "pedidos"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "facturas_pedidoId_idx" ON "facturas"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_empresaId_numero_key" ON "facturas"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "factura_detalles_pedidoDetalleId_idx" ON "factura_detalles"("pedidoDetalleId");

-- CreateIndex
CREATE INDEX "factura_detalles_presentacionId_idx" ON "factura_detalles"("presentacionId");

-- CreateIndex
CREATE UNIQUE INDEX "factura_detalles_facturaId_pedidoDetalleId_key" ON "factura_detalles"("facturaId", "pedidoDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_cobranza_empresaId_key" ON "politicas_cobranza"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_electronicos_empresaId_tipoDocumento_documento_key" ON "comprobantes_electronicos"("empresaId", "tipoDocumento", "documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_debito_recargoMoraId_key" ON "notas_debito"("recargoMoraId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_debito_empresaId_numero_key" ON "notas_debito"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "notas_credito_empresaId_numero_key" ON "notas_credito"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "nota_credito_detalles_devolucionDetalleId_idx" ON "nota_credito_detalles"("devolucionDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_cliente_notaCreditoId_key" ON "creditos_cliente"("notaCreditoId");

-- CreateIndex
CREATE INDEX "creditos_cliente_clienteId_estado_idx" ON "creditos_cliente"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "aplicaciones_credito_cliente_creditoId_idx" ON "aplicaciones_credito_cliente"("creditoId");

-- CreateIndex
CREATE INDEX "aplicaciones_credito_cliente_facturaId_idx" ON "aplicaciones_credito_cliente"("facturaId");

-- CreateIndex
CREATE INDEX "reembolsos_cliente_creditoId_estadoAprobacion_idx" ON "reembolsos_cliente"("creditoId", "estadoAprobacion");

-- CreateIndex
CREATE INDEX "devoluciones_cliente_facturaId_idx" ON "devoluciones_cliente"("facturaId");

-- CreateIndex
CREATE INDEX "devoluciones_cliente_almacenId_estado_idx" ON "devoluciones_cliente"("almacenId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_cliente_empresaId_numero_key" ON "devoluciones_cliente"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "devolucion_cliente_detalles_facturaDetalleId_idx" ON "devolucion_cliente_detalles"("facturaDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "devolucion_cliente_detalles_devolucionId_facturaDetalleId_key" ON "devolucion_cliente_detalles"("devolucionId", "facturaDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "acuerdos_suministro_empresaId_numero_key" ON "acuerdos_suministro"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "acuerdo_suministro_lineas_acuerdoId_insumoId_key" ON "acuerdo_suministro_lineas"("acuerdoId", "insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_compras_empresaId_numero_key" ON "rfq_compras"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_compra_lineas_rfqId_insumoId_key" ON "rfq_compra_lineas"("rfqId", "insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "ofertas_rfq_rfqId_proveedorId_key" ON "ofertas_rfq"("rfqId", "proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "oferta_rfq_lineas_ofertaId_rfqLineaId_key" ON "oferta_rfq_lineas"("ofertaId", "rfqLineaId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_rfqId_key" ON "ordenes_compra"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_empresaId_numero_key" ON "ordenes_compra"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "niveles_aprobacion_compra_empresaId_almacenId_activo_idx" ON "niveles_aprobacion_compra"("empresaId", "almacenId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_aprobacion_compra_empresaId_orden_key" ON "niveles_aprobacion_compra"("empresaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "pasos_aprobacion_compra_ordenCompraId_orden_key" ON "pasos_aprobacion_compra"("ordenCompraId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_compra_empresaId_numero_key" ON "recepciones_compra"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_proveedor_devolucionCompraId_key" ON "creditos_proveedor"("devolucionCompraId");

-- CreateIndex
CREATE INDEX "creditos_proveedor_proveedorId_estado_idx" ON "creditos_proveedor"("proveedorId", "estado");

-- CreateIndex
CREATE INDEX "aplicaciones_credito_proveedor_creditoId_idx" ON "aplicaciones_credito_proveedor"("creditoId");

-- CreateIndex
CREATE INDEX "aplicaciones_credito_proveedor_cuentaPorPagarId_idx" ON "aplicaciones_credito_proveedor"("cuentaPorPagarId");

-- CreateIndex
CREATE INDEX "reembolsos_proveedor_creditoId_idx" ON "reembolsos_proveedor"("creditoId");

-- CreateIndex
CREATE UNIQUE INDEX "inspecciones_compra_recepcionCompraDetalleId_key" ON "inspecciones_compra"("recepcionCompraDetalleId");

-- CreateIndex
CREATE INDEX "planes_inspeccion_insumo_empresaId_activo_idx" ON "planes_inspeccion_insumo"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "planes_inspeccion_insumo_insumoId_version_key" ON "planes_inspeccion_insumo"("insumoId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "caracteristicas_plan_insumo_planId_secuencia_key" ON "caracteristicas_plan_insumo"("planId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "mediciones_inspeccion_compra_inspeccionCompraId_secuencia_key" ON "mediciones_inspeccion_compra"("inspeccionCompraId", "secuencia");

-- CreateIndex
CREATE INDEX "campanas_certificacion_accesos_empresaId_estado_idx" ON "campanas_certificacion_accesos"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "campanas_certificacion_accesos_empresaId_numero_key" ON "campanas_certificacion_accesos"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "certificaciones_acceso_usuarioId_idx" ON "certificaciones_acceso"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "certificaciones_acceso_campanaId_usuarioId_key" ON "certificaciones_acceso"("campanaId", "usuarioId");

-- CreateIndex
CREATE INDEX "unidades_manipulacion_empresaId_estado_idx" ON "unidades_manipulacion"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "unidades_manipulacion_zonaAlmacenId_idx" ON "unidades_manipulacion"("zonaAlmacenId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_manipulacion_empresaId_codigo_key" ON "unidades_manipulacion"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_manipulacion_contenidos_unidadId_presentacionId_key" ON "unidad_manipulacion_contenidos"("unidadId", "presentacionId");

-- CreateIndex
CREATE INDEX "oleadas_picking_empresaId_estado_idx" ON "oleadas_picking"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "oleadas_picking_empresaId_numero_key" ON "oleadas_picking"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "oleada_picking_guias_guiaId_idx" ON "oleada_picking_guias"("guiaId");

-- CreateIndex
CREATE UNIQUE INDEX "oleada_picking_guias_oleadaId_guiaId_key" ON "oleada_picking_guias"("oleadaId", "guiaId");

-- CreateIndex
CREATE UNIQUE INDEX "picking_lineas_oleadaId_presentacionId_key" ON "picking_lineas"("oleadaId", "presentacionId");

-- CreateIndex
CREATE UNIQUE INDEX "licitaciones_flete_empresaId_numero_key" ON "licitaciones_flete"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ofertas_flete_licitacionId_transportistaId_key" ON "ofertas_flete"("licitacionId", "transportistaId");

-- CreateIndex
CREATE UNIQUE INDEX "transportistas_empresaId_codigo_key" ON "transportistas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "transportistas_empresaId_ruc_key" ON "transportistas"("empresaId", "ruc");

-- CreateIndex
CREATE UNIQUE INDEX "transportista_vehiculos_transportistaId_placa_key" ON "transportista_vehiculos"("transportistaId", "placa");

-- CreateIndex
CREATE UNIQUE INDEX "transportista_conductores_transportistaId_dni_key" ON "transportista_conductores"("transportistaId", "dni");

-- CreateIndex
CREATE INDEX "guias_remision_pedidoId_idx" ON "guias_remision"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "guias_remision_empresaId_numero_key" ON "guias_remision"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ubigeos_codigo_key" ON "ubigeos"("codigo");

-- CreateIndex
CREATE INDEX "guia_remision_detalles_pedidoDetalleId_idx" ON "guia_remision_detalles"("pedidoDetalleId");

-- CreateIndex
CREATE INDEX "factura_detalle_entregas_guiaDetalleId_idx" ON "factura_detalle_entregas"("guiaDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "factura_detalle_entregas_facturaDetalleId_guiaDetalleId_key" ON "factura_detalle_entregas"("facturaDetalleId", "guiaDetalleId");

-- CreateIndex
CREATE INDEX "movimientos_caja_cuentaBancariaId_fecha_idx" ON "movimientos_caja"("cuentaBancariaId", "fecha");

-- CreateIndex
CREATE INDEX "conciliaciones_bancarias_empresaId_estado_idx" ON "conciliaciones_bancarias"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "conciliaciones_bancarias_cuentaBancariaId_fechaDesde_fechaH_key" ON "conciliaciones_bancarias"("cuentaBancariaId", "fechaDesde", "fechaHasta");

-- CreateIndex
CREATE INDEX "movimientos_extracto_bancario_conciliacionId_fecha_idx" ON "movimientos_extracto_bancario"("conciliacionId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_extracto_bancario_conciliacionId_huella_key" ON "movimientos_extracto_bancario"("conciliacionId", "huella");

-- CreateIndex
CREATE INDEX "conciliaciones_bancarias_aplicaciones_movimientoCajaId_idx" ON "conciliaciones_bancarias_aplicaciones"("movimientoCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "conciliaciones_bancarias_aplicaciones_movimientoExtractoId__key" ON "conciliaciones_bancarias_aplicaciones"("movimientoExtractoId", "movimientoCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "hojas_ruta_empresaId_numero_key" ON "hojas_ruta"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "series_documento_empresaId_tipoDocumento_serie_key" ON "series_documento"("empresaId", "tipoDocumento", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "almacenes_empresaId_codigo_key" ON "almacenes"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "calendarios_produccion_almacenId_key" ON "calendarios_produccion"("almacenId");

-- CreateIndex
CREATE UNIQUE INDEX "dias_no_laborables_calendarioId_fecha_key" ON "dias_no_laborables"("calendarioId", "fecha");

-- CreateIndex
CREATE INDEX "zonas_almacen_almacenId_parentId_idx" ON "zonas_almacen"("almacenId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_almacen_almacenId_codigo_key" ON "zonas_almacen"("almacenId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "clases_unidad_medida_empresaId_codigo_key" ON "clases_unidad_medida"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_claseId_codigo_key" ON "unidades_medida"("claseId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_seguridad_empresaId_codigo_key" ON "grupos_seguridad"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_grupo_grupoId_modulo_key" ON "permisos_grupo"("grupoId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "tareas_cierre_periodo_periodoFiscalId_orden_key" ON "tareas_cierre_periodo"("periodoFiscalId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_fiscales_empresaId_anio_mes_key" ON "periodos_fiscales"("empresaId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "planes_cuentas_empresaId_codigo_key" ON "planes_cuentas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_contables_planCuentasId_codigo_key" ON "cuentas_contables"("planCuentasId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "libros_empresaId_codigo_key" ON "libros"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "asientos_contables_anio_mes_idx" ON "asientos_contables"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "asientos_contables_empresaId_numero_key" ON "asientos_contables"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "asiento_detalles_cuentaId_idx" ON "asiento_detalles"("cuentaId");

-- CreateIndex
CREATE INDEX "asiento_detalles_centroCostoId_idx" ON "asiento_detalles"("centroCostoId");

-- CreateIndex
CREATE UNIQUE INDEX "controles_contables_empresaId_clave_key" ON "controles_contables"("empresaId", "clave");

-- CreateIndex
CREATE INDEX "centros_costo_parentId_idx" ON "centros_costo"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "centros_costo_empresaId_codigo_key" ON "centros_costo"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_centro_costo_centroCostoId_anio_mes_key" ON "presupuestos_centro_costo"("centroCostoId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_internas_empresaId_codigo_key" ON "ordenes_internas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "reglas_asignacion_costo_detalles_reglaId_centroCostoId_key" ON "reglas_asignacion_costo_detalles"("reglaId", "centroCostoId");

-- CreateIndex
CREATE UNIQUE INDEX "centro_costo_controles_empresaId_clave_key" ON "centro_costo_controles"("empresaId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "activos_fijos_empresaId_codigo_key" ON "activos_fijos"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "depreciaciones_activo_activoFijoId_anio_mes_key" ON "depreciaciones_activo"("activoFijoId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_empresaId_codigo_key" ON "proyectos"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "precedencias_actividad_actividadPredecesoraId_actividadSuce_key" ON "precedencias_actividad"("actividadPredecesoraId", "actividadSucesoraId");

-- CreateIndex
CREATE UNIQUE INDEX "centros_trabajo_empresaId_codigo_key" ON "centros_trabajo"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "ubicaciones_tecnicas_empresaId_parentId_idx" ON "ubicaciones_tecnicas"("empresaId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_tecnicas_empresaId_codigo_key" ON "ubicaciones_tecnicas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_activoFijoId_key" ON "equipos"("activoFijoId");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_empresaId_codigo_key" ON "equipos"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "lecturas_contador_equipo_equipoId_creadoEn_idx" ON "lecturas_contador_equipo"("equipoId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_mantenimiento_avisoMantenimientoId_key" ON "ordenes_mantenimiento"("avisoMantenimientoId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_mantenimiento_empresaId_codigo_key" ON "ordenes_mantenimiento"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "avisos_mantenimiento_empresaId_estado_prioridad_idx" ON "avisos_mantenimiento"("empresaId", "estado", "prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "repuestos_plan_mantenimiento_planMantenimientoId_insumoId_key" ON "repuestos_plan_mantenimiento"("planMantenimientoId", "insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "proyecciones_empresaId_anio_trimestre_key" ON "proyecciones"("empresaId", "anio", "trimestre");

-- CreateIndex
CREATE UNIQUE INDEX "proyeccion_detalles_proyeccionId_presentacionId_key" ON "proyeccion_detalles"("proyeccionId", "presentacionId");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cambio_fecha_key" ON "tipos_cambio"("fecha");

-- CreateIndex
CREATE INDEX "posiciones_organizativas_empresaId_activa_idx" ON "posiciones_organizativas"("empresaId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "posiciones_organizativas_empresaId_codigo_key" ON "posiciones_organizativas"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "asignaciones_posicion_empresaId_posicionId_vigenteDesde_idx" ON "asignaciones_posicion"("empresaId", "posicionId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "asignaciones_posicion_empresaId_empleadoId_vigenteDesde_idx" ON "asignaciones_posicion"("empresaId", "empleadoId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_usuarioId_key" ON "empleados"("usuarioId");

-- CreateIndex
CREATE INDEX "empleados_jefeDirectoId_idx" ON "empleados"("jefeDirectoId");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_empresaId_codigo_key" ON "empleados"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_empresaId_dni_key" ON "empleados"("empresaId", "dni");

-- CreateIndex
CREATE INDEX "cambios_salariales_empleadoId_vigenteDesde_idx" ON "cambios_salariales"("empleadoId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_trabajo_empresaId_codigo_key" ON "turnos_trabajo"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "registros_asistencia_empresaId_fecha_estado_idx" ON "registros_asistencia"("empresaId", "fecha", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "registros_asistencia_empleadoId_fecha_key" ON "registros_asistencia"("empleadoId", "fecha");

-- CreateIndex
CREATE INDEX "politicas_tiempo_trabajo_empresaId_estado_vigenteDesde_idx" ON "politicas_tiempo_trabajo"("empresaId", "estado", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_tiempo_trabajo_empresaId_vigenteDesde_key" ON "politicas_tiempo_trabajo"("empresaId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "tasas_afp_afp_tipoComision_vigenteDesde_key" ON "tasas_afp"("afp", "tipoComision", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "planilla_periodos_empresaId_anio_mes_tipo_key" ON "planilla_periodos"("empresaId", "anio", "mes", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "planilla_detalles_planillaPeriodoId_empleadoId_key" ON "planilla_detalles"("planillaPeriodoId", "empleadoId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_desvinculacion_empleadoId_key" ON "liquidaciones_desvinculacion"("empleadoId");

-- CreateIndex
CREATE INDEX "adjuntos_entidadTipo_entidadId_idx" ON "adjuntos"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "tareas_programadas_clave_ejecutadoEn_idx" ON "tareas_programadas"("clave", "ejecutadoEn");

-- CreateIndex
CREATE INDEX "direcciones_entidadTipo_entidadId_idx" ON "direcciones"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "contactos_entidadTipo_entidadId_idx" ON "contactos"("entidadTipo", "entidadId");

-- AddForeignKey
ALTER TABLE "incidencias_contables" ADD CONSTRAINT "incidencias_contables_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_empresa" ADD CONSTRAINT "configuracion_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_empresa" ADD CONSTRAINT "configuracion_empresa_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias_empresa" ADD CONSTRAINT "cuentas_bancarias_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_grupoSeguridadId_fkey" FOREIGN KEY ("grupoSeguridadId") REFERENCES "grupos_seguridad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_maestros" ADD CONSTRAINT "auditoria_maestros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalones_precio" ADD CONSTRAINT "escalones_precio_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condiciones_comerciales_proveedor" ADD CONSTRAINT "condiciones_comerciales_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_casco" ADD CONSTRAINT "movimientos_casco_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_casco" ADD CONSTRAINT "movimientos_casco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_casco" ADD CONSTRAINT "movimientos_casco_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_zona" ADD CONSTRAINT "saldos_zona_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_zona" ADD CONSTRAINT "saldos_zona_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_zona" ADD CONSTRAINT "saldos_zona_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_almacen" ADD CONSTRAINT "saldos_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_almacen" ADD CONSTRAINT "saldos_almacen_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_almacen" ADD CONSTRAINT "saldos_almacen_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_inventario_detalles" ADD CONSTRAINT "conteo_inventario_detalles_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "conteos_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_inventario_detalles" ADD CONSTRAINT "conteo_inventario_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_inventario_detalles" ADD CONSTRAINT "conteo_inventario_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulas" ADD CONSTRAINT "formulas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulas" ADD CONSTRAINT "formulas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_detalles" ADD CONSTRAINT "formula_detalles_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_detalles" ADD CONSTRAINT "formula_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_operaciones" ADD CONSTRAINT "formula_operaciones_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_operaciones" ADD CONSTRAINT "formula_operaciones_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_granel" ADD CONSTRAINT "lotes_granel_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_granel" ADD CONSTRAINT "lotes_granel_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_granel" ADD CONSTRAINT "lotes_granel_loteOrigenId_fkey" FOREIGN KEY ("loteOrigenId") REFERENCES "lotes_granel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_insumo_produccion" ADD CONSTRAINT "reservas_insumo_produccion_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_insumo_produccion" ADD CONSTRAINT "reservas_insumo_produccion_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_material_produccion" ADD CONSTRAINT "movimientos_material_produccion_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_material_produccion" ADD CONSTRAINT "movimientos_material_produccion_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_asignacion_lote_insumo" ADD CONSTRAINT "devoluciones_asignacion_lote_insumo_movimientoMaterialId_fkey" FOREIGN KEY ("movimientoMaterialId") REFERENCES "movimientos_material_produccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_asignacion_lote_insumo" ADD CONSTRAINT "devoluciones_asignacion_lote_insumo_asignacionLoteInsumoId_fkey" FOREIGN KEY ("asignacionLoteInsumoId") REFERENCES "asignaciones_lote_insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_operaciones" ADD CONSTRAINT "lote_operaciones_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_operaciones" ADD CONSTRAINT "lote_operaciones_formulaOperacionId_fkey" FOREIGN KEY ("formulaOperacionId") REFERENCES "formula_operaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_operaciones" ADD CONSTRAINT "lote_operaciones_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_operaciones" ADD CONSTRAINT "lote_operaciones_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_calidad" ADD CONSTRAINT "controles_calidad_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_calidad" ADD CONSTRAINT "controles_calidad_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "causas_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_calidad" ADD CONSTRAINT "controles_calidad_planInspeccionId_fkey" FOREIGN KEY ("planInspeccionId") REFERENCES "planes_inspeccion_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_conformidades_calidad" ADD CONSTRAINT "no_conformidades_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_conformidades_calidad" ADD CONSTRAINT "no_conformidades_calidad_controlCalidadId_fkey" FOREIGN KEY ("controlCalidadId") REFERENCES "controles_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_no_conformidad_calidad" ADD CONSTRAINT "eventos_no_conformidad_calidad_noConformidadId_fkey" FOREIGN KEY ("noConformidadId") REFERENCES "no_conformidades_calidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_inspeccion_calidad" ADD CONSTRAINT "planes_inspeccion_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_inspeccion_calidad" ADD CONSTRAINT "planes_inspeccion_calidad_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristicas_plan_calidad" ADD CONSTRAINT "caracteristicas_plan_calidad_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_inspeccion_calidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_caracteristica_calidad" ADD CONSTRAINT "resultados_caracteristica_calidad_controlCalidadId_fkey" FOREIGN KEY ("controlCalidadId") REFERENCES "controles_calidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "causas_calidad" ADD CONSTRAINT "causas_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos_cliente" ADD CONSTRAINT "reclamos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos_cliente" ADD CONSTRAINT "reclamos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos_cliente" ADD CONSTRAINT "reclamos_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos_cliente" ADD CONSTRAINT "reclamos_cliente_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "causas_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envasados" ADD CONSTRAINT "envasados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envasados" ADD CONSTRAINT "envasados_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envasados" ADD CONSTRAINT "envasados_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_venta" ADD CONSTRAINT "asignaciones_lote_venta_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_venta" ADD CONSTRAINT "asignaciones_lote_venta_facturaDetalleId_fkey" FOREIGN KEY ("facturaDetalleId") REFERENCES "factura_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_venta" ADD CONSTRAINT "asignaciones_lote_venta_guiaDetalleId_fkey" FOREIGN KEY ("guiaDetalleId") REFERENCES "guia_remision_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_venta" ADD CONSTRAINT "asignaciones_lote_venta_devolucionDetalleId_fkey" FOREIGN KEY ("devolucionDetalleId") REFERENCES "devolucion_cliente_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_venta" ADD CONSTRAINT "asignaciones_lote_venta_envasadoId_fkey" FOREIGN KEY ("envasadoId") REFERENCES "envasados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envasado_insumos" ADD CONSTRAINT "envasado_insumos_envasadoId_fkey" FOREIGN KEY ("envasadoId") REFERENCES "envasados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envasado_insumos" ADD CONSTRAINT "envasado_insumos_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones_cliente" ADD CONSTRAINT "direcciones_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones_cliente" ADD CONSTRAINT "direcciones_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones_cliente" ADD CONSTRAINT "direcciones_cliente_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_cliente" ADD CONSTRAINT "contactos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_cliente" ADD CONSTRAINT "contactos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias_cliente" ADD CONSTRAINT "cuentas_bancarias_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias_cliente" ADD CONSTRAINT "cuentas_bancarias_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuentos_canal" ADD CONSTRAINT "descuentos_canal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_cambio_credito" ADD CONSTRAINT "solicitudes_cambio_credito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_cambio_credito" ADD CONSTRAINT "solicitudes_cambio_credito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_almacenDespachoId_fkey" FOREIGN KEY ("almacenDespachoId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_transportistaPreferidoId_fkey" FOREIGN KEY ("transportistaPreferidoId") REFERENCES "transportistas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_detalles" ADD CONSTRAINT "cotizacion_detalles_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_detalles" ADD CONSTRAINT "cotizacion_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_direccionEntregaId_fkey" FOREIGN KEY ("direccionEntregaId") REFERENCES "direcciones_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_detalles" ADD CONSTRAINT "pedido_detalles_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_detalles" ADD CONSTRAINT "pedido_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalles" ADD CONSTRAINT "factura_detalles_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalles" ADD CONSTRAINT "factura_detalles_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalles" ADD CONSTRAINT "factura_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recargos_mora" ADD CONSTRAINT "recargos_mora_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_cobranza" ADD CONSTRAINT "politicas_cobranza_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_cobranza" ADD CONSTRAINT "avisos_cobranza_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_cobranza" ADD CONSTRAINT "avisos_cobranza_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_cobranza" ADD CONSTRAINT "avisos_cobranza_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_debito" ADD CONSTRAINT "notas_debito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_debito" ADD CONSTRAINT "notas_debito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_debito" ADD CONSTRAINT "notas_debito_recargoMoraId_fkey" FOREIGN KEY ("recargoMoraId") REFERENCES "recargos_mora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_credito_detalles" ADD CONSTRAINT "nota_credito_detalles_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "notas_credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_credito_detalles" ADD CONSTRAINT "nota_credito_detalles_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_credito_detalles" ADD CONSTRAINT "nota_credito_detalles_devolucionDetalleId_fkey" FOREIGN KEY ("devolucionDetalleId") REFERENCES "devolucion_cliente_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_cliente" ADD CONSTRAINT "creditos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_cliente" ADD CONSTRAINT "creditos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_cliente" ADD CONSTRAINT "creditos_cliente_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "notas_credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_credito_cliente" ADD CONSTRAINT "aplicaciones_credito_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_credito_cliente" ADD CONSTRAINT "aplicaciones_credito_cliente_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_credito_cliente" ADD CONSTRAINT "aplicaciones_credito_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reembolsos_cliente" ADD CONSTRAINT "reembolsos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reembolsos_cliente" ADD CONSTRAINT "reembolsos_cliente_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_cliente" ADD CONSTRAINT "devoluciones_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_cliente" ADD CONSTRAINT "devoluciones_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_cliente" ADD CONSTRAINT "devoluciones_cliente_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_cliente_detalles" ADD CONSTRAINT "devolucion_cliente_detalles_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_cliente_detalles" ADD CONSTRAINT "devolucion_cliente_detalles_facturaDetalleId_fkey" FOREIGN KEY ("facturaDetalleId") REFERENCES "factura_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdos_suministro" ADD CONSTRAINT "acuerdos_suministro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdos_suministro" ADD CONSTRAINT "acuerdos_suministro_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdo_suministro_lineas" ADD CONSTRAINT "acuerdo_suministro_lineas_acuerdoId_fkey" FOREIGN KEY ("acuerdoId") REFERENCES "acuerdos_suministro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdo_suministro_lineas" ADD CONSTRAINT "acuerdo_suministro_lineas_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_compras" ADD CONSTRAINT "rfq_compras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_compra_lineas" ADD CONSTRAINT "rfq_compra_lineas_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfq_compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_compra_lineas" ADD CONSTRAINT "rfq_compra_lineas_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_rfq" ADD CONSTRAINT "ofertas_rfq_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfq_compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_rfq" ADD CONSTRAINT "ofertas_rfq_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_rfq_lineas" ADD CONSTRAINT "oferta_rfq_lineas_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "ofertas_rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_rfq_lineas" ADD CONSTRAINT "oferta_rfq_lineas_rfqLineaId_fkey" FOREIGN KEY ("rfqLineaId") REFERENCES "rfq_compra_lineas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfq_compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_acuerdoId_fkey" FOREIGN KEY ("acuerdoId") REFERENCES "acuerdos_suministro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveles_aprobacion_compra" ADD CONSTRAINT "niveles_aprobacion_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveles_aprobacion_compra" ADD CONSTRAINT "niveles_aprobacion_compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasos_aprobacion_compra" ADD CONSTRAINT "pasos_aprobacion_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_detalles" ADD CONSTRAINT "orden_compra_detalles_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_detalles" ADD CONSTRAINT "orden_compra_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_detalles" ADD CONSTRAINT "orden_compra_detalles_acuerdoLineaId_fkey" FOREIGN KEY ("acuerdoLineaId") REFERENCES "acuerdo_suministro_lineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra" ADD CONSTRAINT "recepciones_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones_compra" ADD CONSTRAINT "recepciones_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_compra_detalles" ADD CONSTRAINT "recepcion_compra_detalles_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "recepciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_compra_detalles" ADD CONSTRAINT "recepcion_compra_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_compra" ADD CONSTRAINT "devoluciones_compra_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_devolucionCompraId_fkey" FOREIGN KEY ("devolucionCompraId") REFERENCES "devoluciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_credito_proveedor" ADD CONSTRAINT "aplicaciones_credito_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_credito_proveedor" ADD CONSTRAINT "aplicaciones_credito_proveedor_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_credito_proveedor" ADD CONSTRAINT "aplicaciones_credito_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reembolsos_proveedor" ADD CONSTRAINT "reembolsos_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reembolsos_proveedor" ADD CONSTRAINT "reembolsos_proveedor_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_insumo" ADD CONSTRAINT "asignaciones_lote_insumo_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_lote_insumo" ADD CONSTRAINT "asignaciones_lote_insumo_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones_compra" ADD CONSTRAINT "inspecciones_compra_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecciones_compra" ADD CONSTRAINT "inspecciones_compra_planInspeccionId_fkey" FOREIGN KEY ("planInspeccionId") REFERENCES "planes_inspeccion_insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_inspeccion_insumo" ADD CONSTRAINT "planes_inspeccion_insumo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_inspeccion_insumo" ADD CONSTRAINT "planes_inspeccion_insumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristicas_plan_insumo" ADD CONSTRAINT "caracteristicas_plan_insumo_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_inspeccion_insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediciones_inspeccion_compra" ADD CONSTRAINT "mediciones_inspeccion_compra_inspeccionCompraId_fkey" FOREIGN KEY ("inspeccionCompraId") REFERENCES "inspecciones_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanas_certificacion_accesos" ADD CONSTRAINT "campanas_certificacion_accesos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificaciones_acceso" ADD CONSTRAINT "certificaciones_acceso_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas_certificacion_accesos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificaciones_acceso" ADD CONSTRAINT "certificaciones_acceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_manipulacion" ADD CONSTRAINT "unidades_manipulacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_manipulacion" ADD CONSTRAINT "unidades_manipulacion_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidad_manipulacion_contenidos" ADD CONSTRAINT "unidad_manipulacion_contenidos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades_manipulacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidad_manipulacion_contenidos" ADD CONSTRAINT "unidad_manipulacion_contenidos_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oleadas_picking" ADD CONSTRAINT "oleadas_picking_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oleadas_picking" ADD CONSTRAINT "oleadas_picking_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oleada_picking_guias" ADD CONSTRAINT "oleada_picking_guias_oleadaId_fkey" FOREIGN KEY ("oleadaId") REFERENCES "oleadas_picking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oleada_picking_guias" ADD CONSTRAINT "oleada_picking_guias_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "guias_remision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_lineas" ADD CONSTRAINT "picking_lineas_oleadaId_fkey" FOREIGN KEY ("oleadaId") REFERENCES "oleadas_picking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_lineas" ADD CONSTRAINT "picking_lineas_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitaciones_flete" ADD CONSTRAINT "licitaciones_flete_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitaciones_flete" ADD CONSTRAINT "licitaciones_flete_ubigeoOrigenId_fkey" FOREIGN KEY ("ubigeoOrigenId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitaciones_flete" ADD CONSTRAINT "licitaciones_flete_ubigeoDestinoId_fkey" FOREIGN KEY ("ubigeoDestinoId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_flete" ADD CONSTRAINT "ofertas_flete_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "licitaciones_flete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_flete" ADD CONSTRAINT "ofertas_flete_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportistas" ADD CONSTRAINT "transportistas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportista_vehiculos" ADD CONSTRAINT "transportista_vehiculos_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transportista_conductores" ADD CONSTRAINT "transportista_conductores_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_licitacionFleteId_fkey" FOREIGN KEY ("licitacionFleteId") REFERENCES "licitaciones_flete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_ubigeoPartidaId_fkey" FOREIGN KEY ("ubigeoPartidaId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_remision" ADD CONSTRAINT "guias_remision_ubigeoLlegadaId_fkey" FOREIGN KEY ("ubigeoLlegadaId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_remision_detalles" ADD CONSTRAINT "guia_remision_detalles_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "guias_remision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_remision_detalles" ADD CONSTRAINT "guia_remision_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_remision_detalles" ADD CONSTRAINT "guia_remision_detalles_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle_entregas" ADD CONSTRAINT "factura_detalle_entregas_facturaDetalleId_fkey" FOREIGN KEY ("facturaDetalleId") REFERENCES "factura_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle_entregas" ADD CONSTRAINT "factura_detalle_entregas_guiaDetalleId_fkey" FOREIGN KEY ("guiaDetalleId") REFERENCES "guia_remision_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_recepcionCompraId_fkey" FOREIGN KEY ("recepcionCompraId") REFERENCES "recepciones_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliaciones_bancarias" ADD CONSTRAINT "conciliaciones_bancarias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliaciones_bancarias" ADD CONSTRAINT "conciliaciones_bancarias_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_extracto_bancario" ADD CONSTRAINT "movimientos_extracto_bancario_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "conciliaciones_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliaciones_bancarias_aplicaciones" ADD CONSTRAINT "conciliaciones_bancarias_aplicaciones_movimientoExtractoId_fkey" FOREIGN KEY ("movimientoExtractoId") REFERENCES "movimientos_extracto_bancario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliaciones_bancarias_aplicaciones" ADD CONSTRAINT "conciliaciones_bancarias_aplicaciones_movimientoCajaId_fkey" FOREIGN KEY ("movimientoCajaId") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojas_ruta" ADD CONSTRAINT "hojas_ruta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojas_ruta" ADD CONSTRAINT "hojas_ruta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoja_ruta_visitas" ADD CONSTRAINT "hoja_ruta_visitas_hojaRutaId_fkey" FOREIGN KEY ("hojaRutaId") REFERENCES "hojas_ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoja_ruta_visitas" ADD CONSTRAINT "hoja_ruta_visitas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_documento" ADD CONSTRAINT "series_documento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "almacenes" ADD CONSTRAINT "almacenes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "almacenes" ADD CONSTRAINT "almacenes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarios_produccion" ADD CONSTRAINT "calendarios_produccion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dias_no_laborables" ADD CONSTRAINT "dias_no_laborables_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "calendarios_produccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas_almacen" ADD CONSTRAINT "zonas_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas_almacen" ADD CONSTRAINT "zonas_almacen_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "zonas_almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases_unidad_medida" ADD CONSTRAINT "clases_unidad_medida_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_medida" ADD CONSTRAINT "unidades_medida_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "clases_unidad_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_seguridad" ADD CONSTRAINT "grupos_seguridad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_grupo" ADD CONSTRAINT "permisos_grupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_seguridad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_cierre_periodo" ADD CONSTRAINT "tareas_cierre_periodo_periodoFiscalId_fkey" FOREIGN KEY ("periodoFiscalId") REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_fiscales" ADD CONSTRAINT "periodos_fiscales_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_cuentas" ADD CONSTRAINT "planes_cuentas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_planCuentasId_fkey" FOREIGN KEY ("planCuentasId") REFERENCES "planes_cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libros" ADD CONSTRAINT "libros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_libroId_fkey" FOREIGN KEY ("libroId") REFERENCES "libros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_detalles" ADD CONSTRAINT "asiento_detalles_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "asientos_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_detalles" ADD CONSTRAINT "asiento_detalles_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_detalles" ADD CONSTRAINT "asiento_detalles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_contables" ADD CONSTRAINT "controles_contables_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_contables" ADD CONSTRAINT "controles_contables_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos_centro_costo" ADD CONSTRAINT "presupuestos_centro_costo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_internas" ADD CONSTRAINT "ordenes_internas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_internas" ADD CONSTRAINT "ordenes_internas_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_interna_costos" ADD CONSTRAINT "orden_interna_costos_ordenInternaId_fkey" FOREIGN KEY ("ordenInternaId") REFERENCES "ordenes_internas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_asignacion_costo_detalles" ADD CONSTRAINT "reglas_asignacion_costo_detalles_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_asignacion_costo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_asignacion_costo_detalles" ADD CONSTRAINT "reglas_asignacion_costo_detalles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_costo_controles" ADD CONSTRAINT "centro_costo_controles_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_costo_controles" ADD CONSTRAINT "centro_costo_controles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_costo_controles" ADD CONSTRAINT "centro_costo_controles_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_asignacion_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciaciones_activo" ADD CONSTRAINT "depreciaciones_activo_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edt_proyecto" ADD CONSTRAINT "edt_proyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edt_proyecto" ADD CONSTRAINT "edt_proyecto_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "edt_proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_proyecto" ADD CONSTRAINT "actividades_proyecto_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_proyecto" ADD CONSTRAINT "actividades_proyecto_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades_proyecto" ADD CONSTRAINT "actividades_proyecto_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precedencias_actividad" ADD CONSTRAINT "precedencias_actividad_actividadPredecesoraId_fkey" FOREIGN KEY ("actividadPredecesoraId") REFERENCES "actividades_proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precedencias_actividad" ADD CONSTRAINT "precedencias_actividad_actividadSucesoraId_fkey" FOREIGN KEY ("actividadSucesoraId") REFERENCES "actividades_proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costos_proyecto" ADD CONSTRAINT "costos_proyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costos_proyecto" ADD CONSTRAINT "costos_proyecto_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_trabajo" ADD CONSTRAINT "centros_trabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_trabajo" ADD CONSTRAINT "centros_trabajo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_trabajo" ADD CONSTRAINT "centros_trabajo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones_tecnicas" ADD CONSTRAINT "ubicaciones_tecnicas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones_tecnicas" ADD CONSTRAINT "ubicaciones_tecnicas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ubicaciones_tecnicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones_tecnicas" ADD CONSTRAINT "ubicaciones_tecnicas_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_ubicacionTecnicaId_fkey" FOREIGN KEY ("ubicacionTecnicaId") REFERENCES "ubicaciones_tecnicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_contador_equipo" ADD CONSTRAINT "lecturas_contador_equipo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_mantenimiento" ADD CONSTRAINT "ordenes_mantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_mantenimiento" ADD CONSTRAINT "ordenes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_mantenimiento" ADD CONSTRAINT "ordenes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_mantenimiento" ADD CONSTRAINT "ordenes_mantenimiento_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "planes_mantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_mantenimiento" ADD CONSTRAINT "ordenes_mantenimiento_avisoMantenimientoId_fkey" FOREIGN KEY ("avisoMantenimientoId") REFERENCES "avisos_mantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_mantenimiento" ADD CONSTRAINT "avisos_mantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_mantenimiento" ADD CONSTRAINT "avisos_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_mantenimiento" ADD CONSTRAINT "planes_mantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_mantenimiento" ADD CONSTRAINT "planes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_mantenimiento" ADD CONSTRAINT "planes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_plan_mantenimiento" ADD CONSTRAINT "repuestos_plan_mantenimiento_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "planes_mantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_plan_mantenimiento" ADD CONSTRAINT "repuestos_plan_mantenimiento_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_orden_mantenimiento" ADD CONSTRAINT "repuestos_orden_mantenimiento_ordenMantenimientoId_fkey" FOREIGN KEY ("ordenMantenimientoId") REFERENCES "ordenes_mantenimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_orden_mantenimiento" ADD CONSTRAINT "repuestos_orden_mantenimiento_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecciones" ADD CONSTRAINT "proyecciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyeccion_detalles" ADD CONSTRAINT "proyeccion_detalles_proyeccionId_fkey" FOREIGN KEY ("proyeccionId") REFERENCES "proyecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyeccion_detalles" ADD CONSTRAINT "proyeccion_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posiciones_organizativas" ADD CONSTRAINT "posiciones_organizativas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posiciones_organizativas" ADD CONSTRAINT "posiciones_organizativas_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posiciones_organizativas" ADD CONSTRAINT "posiciones_organizativas_reportaAId_fkey" FOREIGN KEY ("reportaAId") REFERENCES "posiciones_organizativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_posicion" ADD CONSTRAINT "asignaciones_posicion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_posicion" ADD CONSTRAINT "asignaciones_posicion_posicionId_fkey" FOREIGN KEY ("posicionId") REFERENCES "posiciones_organizativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_posicion" ADD CONSTRAINT "asignaciones_posicion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_turnoTrabajoId_fkey" FOREIGN KEY ("turnoTrabajoId") REFERENCES "turnos_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_jefeDirectoId_fkey" FOREIGN KEY ("jefeDirectoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_salariales" ADD CONSTRAINT "cambios_salariales_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_trabajo" ADD CONSTRAINT "turnos_trabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_vacaciones" ADD CONSTRAINT "solicitudes_vacaciones_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_planilla" ADD CONSTRAINT "parametros_planilla_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_tiempo_trabajo" ADD CONSTRAINT "politicas_tiempo_trabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planilla_periodos" ADD CONSTRAINT "planilla_periodos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planilla_detalles" ADD CONSTRAINT "planilla_detalles_planillaPeriodoId_fkey" FOREIGN KEY ("planillaPeriodoId") REFERENCES "planilla_periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planilla_detalles" ADD CONSTRAINT "planilla_detalles_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones_desvinculacion" ADD CONSTRAINT "liquidaciones_desvinculacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
