-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_aplicaciones_credito_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "creditoFuncionalAplicado" DECIMAL NOT NULL,
    "cxcFuncionalAplicada" DECIMAL NOT NULL,
    "diferenciaCambio" DECIMAL NOT NULL DEFAULT 0,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "aplicaciones_credito_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "aplicaciones_credito_cliente_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "aplicaciones_credito_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_aplicaciones_credito_cliente" ("creditoFuncionalAplicado", "creditoId", "cxcFuncionalAplicada", "diferenciaCambio", "empresaId", "facturaId", "fecha", "id", "monto", "usuarioId", "usuarioNombre") SELECT "creditoFuncionalAplicado", "creditoId", "cxcFuncionalAplicada", "diferenciaCambio", "empresaId", "facturaId", "fecha", "id", "monto", "usuarioId", "usuarioNombre" FROM "aplicaciones_credito_cliente";
DROP TABLE "aplicaciones_credito_cliente";
ALTER TABLE "new_aplicaciones_credito_cliente" RENAME TO "aplicaciones_credito_cliente";
CREATE INDEX "aplicaciones_credito_cliente_creditoId_idx" ON "aplicaciones_credito_cliente"("creditoId");
CREATE INDEX "aplicaciones_credito_cliente_facturaId_idx" ON "aplicaciones_credito_cliente"("facturaId");
CREATE TABLE "new_avisos_cobranza" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "diasVencidos" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "avisos_cobranza_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "avisos_cobranza_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "avisos_cobranza_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_avisos_cobranza" ("clienteId", "diasVencidos", "empresaId", "facturaId", "fecha", "id", "nivel", "usuarioId", "usuarioNombre") SELECT "clienteId", "diasVencidos", "empresaId", "facturaId", "fecha", "id", "nivel", "usuarioId", "usuarioNombre" FROM "avisos_cobranza";
DROP TABLE "avisos_cobranza";
ALTER TABLE "new_avisos_cobranza" RENAME TO "avisos_cobranza";
CREATE TABLE "new_cobros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "facturaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "cxcFuncionalAplicada" DECIMAL NOT NULL DEFAULT 0,
    "diferenciaCambio" DECIMAL NOT NULL DEFAULT 0,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "cobros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cobros_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cobros" ("cxcFuncionalAplicada", "diferenciaCambio", "empresaId", "facturaId", "fecha", "id", "medioPago", "moneda", "monto", "montoFuncional", "referencia", "tipoCambio", "usuarioId", "usuarioNombre") SELECT "cxcFuncionalAplicada", "diferenciaCambio", "empresaId", "facturaId", "fecha", "id", "medioPago", "moneda", "monto", "montoFuncional", "referencia", "tipoCambio", "usuarioId", "usuarioNombre" FROM "cobros";
DROP TABLE "cobros";
ALTER TABLE "new_cobros" RENAME TO "cobros";
CREATE TABLE "new_comisiones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "vendedorId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tasa" DECIMAL NOT NULL,
    "monto" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comisiones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "comisiones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "comisiones_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_comisiones" ("creadoEn", "empresaId", "estado", "facturaId", "id", "monto", "motivo", "tasa", "tipo", "vendedorId") SELECT "creadoEn", "empresaId", "estado", "facturaId", "id", "monto", "motivo", "tasa", "tipo", "vendedorId" FROM "comisiones";
DROP TABLE "comisiones";
ALTER TABLE "new_comisiones" RENAME TO "comisiones";
CREATE TABLE "new_comprobantes_electronicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipoDocumento" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "proveedorOse" TEXT NOT NULL,
    "codigoHash" TEXT,
    "sunatDescripcion" TEXT,
    "enlacePdf" TEXT,
    "enlaceXml" TEXT,
    "enlaceCdr" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntentoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comprobantes_electronicos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_comprobantes_electronicos" ("codigoHash", "creadoEn", "documentoId", "empresaId", "enlaceCdr", "enlacePdf", "enlaceXml", "estado", "id", "intentos", "numeroDocumento", "proveedorOse", "sunatDescripcion", "tipoDocumento", "ultimoIntentoEn") SELECT "codigoHash", "creadoEn", "documentoId", "empresaId", "enlaceCdr", "enlacePdf", "enlaceXml", "estado", "id", "intentos", "numeroDocumento", "proveedorOse", "sunatDescripcion", "tipoDocumento", "ultimoIntentoEn" FROM "comprobantes_electronicos";
DROP TABLE "comprobantes_electronicos";
ALTER TABLE "new_comprobantes_electronicos" RENAME TO "comprobantes_electronicos";
CREATE UNIQUE INDEX "comprobantes_electronicos_empresaId_tipoDocumento_documentoId_key" ON "comprobantes_electronicos"("empresaId", "tipoDocumento", "documentoId");
CREATE TABLE "new_creditos_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "notaCreditoId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambioOrigen" DECIMAL NOT NULL DEFAULT 1,
    "montoOriginal" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "montoFuncionalOriginal" DECIMAL NOT NULL DEFAULT 0,
    "saldoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creditos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "creditos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "creditos_cliente_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "notas_credito" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_creditos_cliente" ("clienteId", "creadoEn", "empresaId", "estado", "id", "moneda", "montoFuncionalOriginal", "montoOriginal", "notaCreditoId", "saldo", "saldoFuncional", "tipoCambioOrigen") SELECT "clienteId", "creadoEn", "empresaId", "estado", "id", "moneda", "montoFuncionalOriginal", "montoOriginal", "notaCreditoId", "saldo", "saldoFuncional", "tipoCambioOrigen" FROM "creditos_cliente";
DROP TABLE "creditos_cliente";
ALTER TABLE "new_creditos_cliente" RENAME TO "creditos_cliente";
CREATE UNIQUE INDEX "creditos_cliente_notaCreditoId_key" ON "creditos_cliente"("notaCreditoId");
CREATE INDEX "creditos_cliente_clienteId_estado_idx" ON "creditos_cliente"("clienteId", "estado");
CREATE TABLE "new_devoluciones_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "fechaRecepcion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_INSPECCION',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "cerradoEn" DATETIME,
    "cerradoPorId" TEXT,
    "cerradoPorNombre" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devoluciones_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "devoluciones_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "devoluciones_cliente_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_devoluciones_cliente" ("almacenId", "cerradoEn", "cerradoPorId", "cerradoPorNombre", "creadoEn", "empresaId", "estado", "facturaId", "fechaRecepcion", "id", "motivo", "numero", "usuarioId", "usuarioNombre") SELECT "almacenId", "cerradoEn", "cerradoPorId", "cerradoPorNombre", "creadoEn", "empresaId", "estado", "facturaId", "fechaRecepcion", "id", "motivo", "numero", "usuarioId", "usuarioNombre" FROM "devoluciones_cliente";
DROP TABLE "devoluciones_cliente";
ALTER TABLE "new_devoluciones_cliente" RENAME TO "devoluciones_cliente";
CREATE UNIQUE INDEX "devoluciones_cliente_numero_key" ON "devoluciones_cliente"("numero");
CREATE INDEX "devoluciones_cliente_facturaId_idx" ON "devoluciones_cliente"("facturaId");
CREATE INDEX "devoluciones_cliente_almacenId_estado_idx" ON "devoluciones_cliente"("almacenId", "estado");
CREATE TABLE "new_notas_credito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "tipoNota" TEXT NOT NULL DEFAULT 'OTROS_CONCEPTOS',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "notas_credito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notas_credito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_notas_credito" ("empresaId", "facturaId", "fecha", "id", "moneda", "monto", "montoFuncional", "motivo", "numero", "tipoCambio", "tipoNota", "usuarioId", "usuarioNombre") SELECT "empresaId", "facturaId", "fecha", "id", "moneda", "monto", "montoFuncional", "motivo", "numero", "tipoCambio", "tipoNota", "usuarioId", "usuarioNombre" FROM "notas_credito";
DROP TABLE "notas_credito";
ALTER TABLE "new_notas_credito" RENAME TO "notas_credito";
CREATE UNIQUE INDEX "notas_credito_numero_key" ON "notas_credito"("numero");
CREATE TABLE "new_reembolsos_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "creditoId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL NOT NULL,
    "creditoFuncionalAplicado" DECIMAL NOT NULL,
    "diferenciaCambio" DECIMAL NOT NULL DEFAULT 0,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadoPor" TEXT,
    "aprobadoEn" DATETIME,
    "motivoRechazo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "reembolsos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reembolsos_cliente_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_reembolsos_cliente" ("aprobadoEn", "aprobadoPor", "creditoFuncionalAplicado", "creditoId", "diferenciaCambio", "empresaId", "estadoAprobacion", "fecha", "id", "medioPago", "moneda", "monto", "montoFuncional", "motivoRechazo", "referencia", "tipoCambio", "usuarioId", "usuarioNombre") SELECT "aprobadoEn", "aprobadoPor", "creditoFuncionalAplicado", "creditoId", "diferenciaCambio", "empresaId", "estadoAprobacion", "fecha", "id", "medioPago", "moneda", "monto", "montoFuncional", "motivoRechazo", "referencia", "tipoCambio", "usuarioId", "usuarioNombre" FROM "reembolsos_cliente";
DROP TABLE "reembolsos_cliente";
ALTER TABLE "new_reembolsos_cliente" RENAME TO "reembolsos_cliente";
CREATE INDEX "reembolsos_cliente_creditoId_estadoAprobacion_idx" ON "reembolsos_cliente"("creditoId", "estadoAprobacion");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
