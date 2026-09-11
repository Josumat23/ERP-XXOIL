-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_acuerdos_suministro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "vigenteDesde" DATETIME NOT NULL,
    "vigenteHasta" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acuerdos_suministro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "acuerdos_suministro_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_acuerdos_suministro" ("creadoEn", "empresaId", "estado", "id", "moneda", "numero", "proveedorId", "tipoCambio", "titulo", "usuarioId", "usuarioNombre", "vigenteDesde", "vigenteHasta") SELECT "creadoEn", "empresaId", "estado", "id", "moneda", "numero", "proveedorId", "tipoCambio", "titulo", "usuarioId", "usuarioNombre", "vigenteDesde", "vigenteHasta" FROM "acuerdos_suministro";
DROP TABLE "acuerdos_suministro";
ALTER TABLE "new_acuerdos_suministro" RENAME TO "acuerdos_suministro";
CREATE UNIQUE INDEX "acuerdos_suministro_empresaId_numero_key" ON "acuerdos_suministro"("empresaId", "numero");
CREATE TABLE "new_aplicaciones_credito_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "cuentaPorPagarId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoFuncional" DECIMAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "aplicaciones_credito_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "aplicaciones_credito_proveedor_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "aplicaciones_credito_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_aplicaciones_credito_proveedor" ("creditoId", "cuentaPorPagarId", "empresaId", "fecha", "id", "montoFuncional", "usuarioId", "usuarioNombre") SELECT "creditoId", "cuentaPorPagarId", "empresaId", "fecha", "id", "montoFuncional", "usuarioId", "usuarioNombre" FROM "aplicaciones_credito_proveedor";
DROP TABLE "aplicaciones_credito_proveedor";
ALTER TABLE "new_aplicaciones_credito_proveedor" RENAME TO "aplicaciones_credito_proveedor";
CREATE INDEX "aplicaciones_credito_proveedor_creditoId_idx" ON "aplicaciones_credito_proveedor"("creditoId");
CREATE INDEX "aplicaciones_credito_proveedor_cuentaPorPagarId_idx" ON "aplicaciones_credito_proveedor"("cuentaPorPagarId");
CREATE TABLE "new_creditos_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT NOT NULL,
    "devolucionCompraId" TEXT NOT NULL,
    "montoFuncionalOriginal" DECIMAL NOT NULL,
    "saldoFuncional" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creditos_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "creditos_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "creditos_proveedor_devolucionCompraId_fkey" FOREIGN KEY ("devolucionCompraId") REFERENCES "devoluciones_compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_creditos_proveedor" ("creadoEn", "devolucionCompraId", "empresaId", "estado", "id", "montoFuncionalOriginal", "proveedorId", "saldoFuncional") SELECT "creadoEn", "devolucionCompraId", "empresaId", "estado", "id", "montoFuncionalOriginal", "proveedorId", "saldoFuncional" FROM "creditos_proveedor";
DROP TABLE "creditos_proveedor";
ALTER TABLE "new_creditos_proveedor" RENAME TO "creditos_proveedor";
CREATE UNIQUE INDEX "creditos_proveedor_devolucionCompraId_key" ON "creditos_proveedor"("devolucionCompraId");
CREATE INDEX "creditos_proveedor_proveedorId_estado_idx" ON "creditos_proveedor"("proveedorId", "estado");
CREATE TABLE "new_cuentas_por_pagar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT NOT NULL,
    "ordenCompraId" TEXT,
    "recepcionCompraId" TEXT,
    "numeroDocumento" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL DEFAULT '01',
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "total" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "montoOriginal" DECIMAL,
    "monedaOriginal" TEXT,
    "tipoCambio" DECIMAL,
    "discrepanciaPrecioPct" DECIMAL,
    "estadoVerificacion" TEXT NOT NULL DEFAULT 'COINCIDE',
    "verificacionResueltaPorId" TEXT,
    "verificacionResueltaPorNombre" TEXT,
    "verificacionResueltaEn" DATETIME,
    "motivoExcepcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "cuentas_por_pagar_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cuentas_por_pagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cuentas_por_pagar_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cuentas_por_pagar_recepcionCompraId_fkey" FOREIGN KEY ("recepcionCompraId") REFERENCES "recepciones_compra" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cuentas_por_pagar" ("discrepanciaPrecioPct", "empresaId", "estado", "estadoVerificacion", "fechaEmision", "fechaVencimiento", "id", "moneda", "monedaOriginal", "montoOriginal", "motivoExcepcion", "numeroDocumento", "ordenCompraId", "proveedorId", "recepcionCompraId", "saldo", "tipoCambio", "tipoComprobante", "total", "usuarioId", "usuarioNombre", "verificacionResueltaEn", "verificacionResueltaPorId", "verificacionResueltaPorNombre") SELECT "discrepanciaPrecioPct", "empresaId", "estado", "estadoVerificacion", "fechaEmision", "fechaVencimiento", "id", "moneda", "monedaOriginal", "montoOriginal", "motivoExcepcion", "numeroDocumento", "ordenCompraId", "proveedorId", "recepcionCompraId", "saldo", "tipoCambio", "tipoComprobante", "total", "usuarioId", "usuarioNombre", "verificacionResueltaEn", "verificacionResueltaPorId", "verificacionResueltaPorNombre" FROM "cuentas_por_pagar";
DROP TABLE "cuentas_por_pagar";
ALTER TABLE "new_cuentas_por_pagar" RENAME TO "cuentas_por_pagar";
CREATE TABLE "new_devoluciones_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "montoCredito" DECIMAL NOT NULL,
    "montoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devoluciones_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "devoluciones_compra_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_devoluciones_compra" ("cantidad", "creadoEn", "empresaId", "id", "montoCredito", "montoFuncional", "motivo", "recepcionCompraDetalleId", "usuarioId", "usuarioNombre") SELECT "cantidad", "creadoEn", "empresaId", "id", "montoCredito", "montoFuncional", "motivo", "recepcionCompraDetalleId", "usuarioId", "usuarioNombre" FROM "devoluciones_compra";
DROP TABLE "devoluciones_compra";
ALTER TABLE "new_devoluciones_compra" RENAME TO "devoluciones_compra";
CREATE TABLE "new_guias_remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "pedidoId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" DATETIME NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "ubigeoPartidaId" TEXT,
    "ubigeoLlegadaId" TEXT,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "pesoBrutoTotal" DECIMAL NOT NULL DEFAULT 0,
    "modalidadTransporte" TEXT NOT NULL DEFAULT 'PRIVADO',
    "transportista" TEXT,
    "transportistaRuc" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "equipoId" TEXT,
    "estadoDespacho" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "fechaSalida" DATETIME,
    "fechaEntrega" DATETIME,
    "anuladaEn" DATETIME,
    "anuladaPorId" TEXT,
    "anuladaPorNombre" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guias_remision_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoPartidaId_fkey" FOREIGN KEY ("ubigeoPartidaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoLlegadaId_fkey" FOREIGN KEY ("ubigeoLlegadaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_guias_remision" ("anuladaEn", "anuladaPorId", "anuladaPorNombre", "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "modalidadTransporte", "motivoAnulacion", "motivoTraslado", "numero", "observaciones", "pedidoId", "pesoBrutoTotal", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "transportistaRuc", "ubigeoLlegadaId", "ubigeoPartidaId", "usuarioId", "usuarioNombre") SELECT "anuladaEn", "anuladaPorId", "anuladaPorNombre", "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "modalidadTransporte", "motivoAnulacion", "motivoTraslado", "numero", "observaciones", "pedidoId", "pesoBrutoTotal", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "transportistaRuc", "ubigeoLlegadaId", "ubigeoPartidaId", "usuarioId", "usuarioNombre" FROM "guias_remision";
DROP TABLE "guias_remision";
ALTER TABLE "new_guias_remision" RENAME TO "guias_remision";
CREATE UNIQUE INDEX "guias_remision_numero_key" ON "guias_remision"("numero");
CREATE INDEX "guias_remision_pedidoId_idx" ON "guias_remision"("pedidoId");
CREATE TABLE "new_niveles_aprobacion_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoDesdePen" DECIMAL NOT NULL,
    "rolAprobador" TEXT NOT NULL DEFAULT 'GERENCIA',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "niveles_aprobacion_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_niveles_aprobacion_compra" ("activo", "creadoEn", "empresaId", "id", "montoDesdePen", "nombre", "orden", "rolAprobador") SELECT "activo", "creadoEn", "empresaId", "id", "montoDesdePen", "nombre", "orden", "rolAprobador" FROM "niveles_aprobacion_compra";
DROP TABLE "niveles_aprobacion_compra";
ALTER TABLE "new_niveles_aprobacion_compra" RENAME TO "niveles_aprobacion_compra";
CREATE UNIQUE INDEX "niveles_aprobacion_compra_empresaId_orden_key" ON "niveles_aprobacion_compra"("empresaId", "orden");
CREATE TABLE "new_ordenes_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "total" DECIMAL NOT NULL,
    "notas" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadaPor" TEXT,
    "aprobadaEn" DATETIME,
    "motivoRechazo" TEXT,
    "proyectoId" TEXT,
    "edtId" TEXT,
    "rfqId" TEXT,
    "acuerdoId" TEXT,
    CONSTRAINT "ordenes_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfq_compras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_acuerdoId_fkey" FOREIGN KEY ("acuerdoId") REFERENCES "acuerdos_suministro" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ordenes_compra" ("acuerdoId", "almacenId", "aprobadaEn", "aprobadaPor", "edtId", "empresaId", "estado", "estadoAprobacion", "fecha", "id", "moneda", "motivoAnulacion", "motivoRechazo", "notas", "numero", "proveedorId", "proyectoId", "rfqId", "tipoCambio", "total", "usuarioId", "usuarioNombre") SELECT "acuerdoId", "almacenId", "aprobadaEn", "aprobadaPor", "edtId", "empresaId", "estado", "estadoAprobacion", "fecha", "id", "moneda", "motivoAnulacion", "motivoRechazo", "notas", "numero", "proveedorId", "proyectoId", "rfqId", "tipoCambio", "total", "usuarioId", "usuarioNombre" FROM "ordenes_compra";
DROP TABLE "ordenes_compra";
ALTER TABLE "new_ordenes_compra" RENAME TO "ordenes_compra";
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");
CREATE UNIQUE INDEX "ordenes_compra_rfqId_key" ON "ordenes_compra"("rfqId");
CREATE TABLE "new_pagos_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "cuentaPorPagarId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadoPor" TEXT,
    "aprobadoEn" DATETIME,
    "motivoRechazo" TEXT,
    CONSTRAINT "pagos_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pagos_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_pagos_proveedor" ("aprobadoEn", "aprobadoPor", "cuentaPorPagarId", "empresaId", "estadoAprobacion", "fecha", "id", "medioPago", "monto", "motivoRechazo", "referencia", "usuarioId", "usuarioNombre") SELECT "aprobadoEn", "aprobadoPor", "cuentaPorPagarId", "empresaId", "estadoAprobacion", "fecha", "id", "medioPago", "monto", "motivoRechazo", "referencia", "usuarioId", "usuarioNombre" FROM "pagos_proveedor";
DROP TABLE "pagos_proveedor";
ALTER TABLE "new_pagos_proveedor" RENAME TO "pagos_proveedor";
CREATE TABLE "new_planes_inspeccion_insumo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "insumoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planes_inspeccion_insumo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planes_inspeccion_insumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_planes_inspeccion_insumo" ("activo", "creadoEn", "empresaId", "id", "insumoId", "nombre", "usuarioId", "usuarioNombre", "version", "vigenteDesde", "vigenteHasta") SELECT "activo", "creadoEn", "empresaId", "id", "insumoId", "nombre", "usuarioId", "usuarioNombre", "version", "vigenteDesde", "vigenteHasta" FROM "planes_inspeccion_insumo";
DROP TABLE "planes_inspeccion_insumo";
ALTER TABLE "new_planes_inspeccion_insumo" RENAME TO "planes_inspeccion_insumo";
CREATE INDEX "planes_inspeccion_insumo_empresaId_activo_idx" ON "planes_inspeccion_insumo"("empresaId", "activo");
CREATE UNIQUE INDEX "planes_inspeccion_insumo_insumoId_version_key" ON "planes_inspeccion_insumo"("insumoId", "version");
CREATE TABLE "new_recepciones_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "recepciones_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recepciones_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_recepciones_compra" ("empresaId", "fecha", "id", "notas", "numero", "ordenCompraId", "usuarioId", "usuarioNombre") SELECT "empresaId", "fecha", "id", "notas", "numero", "ordenCompraId", "usuarioId", "usuarioNombre" FROM "recepciones_compra";
DROP TABLE "recepciones_compra";
ALTER TABLE "new_recepciones_compra" RENAME TO "recepciones_compra";
CREATE UNIQUE INDEX "recepciones_compra_numero_key" ON "recepciones_compra"("numero");
CREATE TABLE "new_reembolsos_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoFuncional" DECIMAL NOT NULL,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "reembolsos_proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reembolsos_proveedor_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_reembolsos_proveedor" ("creditoId", "empresaId", "fecha", "id", "medioPago", "montoFuncional", "referencia", "usuarioId", "usuarioNombre") SELECT "creditoId", "empresaId", "fecha", "id", "medioPago", "montoFuncional", "referencia", "usuarioId", "usuarioNombre" FROM "reembolsos_proveedor";
DROP TABLE "reembolsos_proveedor";
ALTER TABLE "new_reembolsos_proveedor" RENAME TO "reembolsos_proveedor";
CREATE INDEX "reembolsos_proveedor_creditoId_idx" ON "reembolsos_proveedor"("creditoId");
CREATE TABLE "new_rfq_compras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaLimite" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "justificacionAdjudicacion" TEXT,
    "adjudicadaEn" DATETIME,
    "adjudicadaPorId" TEXT,
    "adjudicadaPorNombre" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "rfq_compras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_rfq_compras" ("actualizadoEn", "adjudicadaEn", "adjudicadaPorId", "adjudicadaPorNombre", "creadoEn", "empresaId", "estado", "fechaLimite", "id", "justificacionAdjudicacion", "numero", "titulo", "usuarioId", "usuarioNombre") SELECT "actualizadoEn", "adjudicadaEn", "adjudicadaPorId", "adjudicadaPorNombre", "creadoEn", "empresaId", "estado", "fechaLimite", "id", "justificacionAdjudicacion", "numero", "titulo", "usuarioId", "usuarioNombre" FROM "rfq_compras";
DROP TABLE "rfq_compras";
ALTER TABLE "new_rfq_compras" RENAME TO "rfq_compras";
CREATE UNIQUE INDEX "rfq_compras_empresaId_numero_key" ON "rfq_compras"("empresaId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
