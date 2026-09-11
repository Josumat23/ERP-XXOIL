-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "canal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "zonaId" TEXT,
    "vendedorId" TEXT,
    "limiteCredito" DECIMAL NOT NULL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "bloqueadoCobranza" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoCobranzaEn" DATETIME,
    "bloqueadoCobranzaPor" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("activo", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "vendedorId", "zonaId") SELECT "activo", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
CREATE TABLE "new_cotizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validaHasta" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "total" DECIMAL NOT NULL,
    "probabilidad" INTEGER NOT NULL DEFAULT 50,
    "notas" TEXT,
    "pedidoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "cotizaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cotizaciones" ("clienteId", "empresaId", "estado", "fecha", "id", "notas", "numero", "pedidoId", "probabilidad", "total", "usuarioId", "usuarioNombre", "validaHasta", "vendedorId") SELECT "clienteId", "empresaId", "estado", "fecha", "id", "notas", "numero", "pedidoId", "probabilidad", "total", "usuarioId", "usuarioNombre", "validaHasta", "vendedorId" FROM "cotizaciones";
DROP TABLE "cotizaciones";
ALTER TABLE "new_cotizaciones" RENAME TO "cotizaciones";
CREATE UNIQUE INDEX "cotizaciones_numero_key" ON "cotizaciones"("numero");
CREATE UNIQUE INDEX "cotizaciones_pedidoId_key" ON "cotizaciones"("pedidoId");
CREATE TABLE "new_descuentos_canal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "canal" TEXT NOT NULL,
    "descuentoPct" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "descuentos_canal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_descuentos_canal" ("canal", "descuentoPct", "empresaId", "id") SELECT "canal", "descuentoPct", "empresaId", "id" FROM "descuentos_canal";
DROP TABLE "descuentos_canal";
ALTER TABLE "new_descuentos_canal" RENAME TO "descuentos_canal";
CREATE UNIQUE INDEX "descuentos_canal_empresaId_canal_key" ON "descuentos_canal"("empresaId", "canal");
CREATE TABLE "new_facturas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "monedaFuncional" TEXT NOT NULL DEFAULT 'PEN',
    "condicionPago" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME NOT NULL,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "tasaIgv" DECIMAL NOT NULL DEFAULT 0,
    "igv" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "subtotalFuncional" DECIMAL NOT NULL DEFAULT 0,
    "igvFuncional" DECIMAL NOT NULL DEFAULT 0,
    "totalFuncional" DECIMAL NOT NULL DEFAULT 0,
    "saldoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoAnulacion" TEXT,
    "anuladaEn" DATETIME,
    "anuladaPor" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "facturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_facturas" ("anuladaEn", "anuladaPor", "clienteId", "condicionPago", "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "igv", "igvFuncional", "moneda", "monedaFuncional", "motivoAnulacion", "numero", "pedidoId", "saldo", "saldoFuncional", "subtotal", "subtotalFuncional", "tasaIgv", "tipoCambio", "total", "totalFuncional", "usuarioId", "usuarioNombre", "vendedorId") SELECT "anuladaEn", "anuladaPor", "clienteId", "condicionPago", "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "igv", "igvFuncional", "moneda", "monedaFuncional", "motivoAnulacion", "numero", "pedidoId", "saldo", "saldoFuncional", "subtotal", "subtotalFuncional", "tasaIgv", "tipoCambio", "total", "totalFuncional", "usuarioId", "usuarioNombre", "vendedorId" FROM "facturas";
DROP TABLE "facturas";
ALTER TABLE "new_facturas" RENAME TO "facturas";
CREATE UNIQUE INDEX "facturas_numero_key" ON "facturas"("numero");
CREATE INDEX "facturas_pedidoId_idx" ON "facturas"("pedidoId");
CREATE TABLE "new_pedidos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntregaSolicitada" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fulfillmentVersion" INTEGER NOT NULL DEFAULT 0,
    "requiereEntrega" BOOLEAN NOT NULL DEFAULT false,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "condicionPago" TEXT NOT NULL DEFAULT 'CONTADO',
    "direccionEntrega" TEXT,
    "ordenCompraCliente" TEXT,
    "referenciaCliente" TEXT,
    "subtotalBruto" DECIMAL NOT NULL DEFAULT 0,
    "descuentoTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "tasaIgv" DECIMAL NOT NULL DEFAULT 0,
    "igv" DECIMAL NOT NULL DEFAULT 0,
    "totalConIgv" DECIMAL NOT NULL DEFAULT 0,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacionCredito" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "condicionPagoCredito" TEXT,
    "deudaCreditoEvaluada" DECIMAL,
    "montoCreditoEvaluado" DECIMAL,
    "limiteCreditoEvaluado" DECIMAL,
    "creditoSolicitadoEn" DATETIME,
    "creditoResueltoEn" DATETIME,
    "creditoResueltoPor" TEXT,
    "motivoRechazoCredito" TEXT,
    CONSTRAINT "pedidos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pedidos" ("almacenId", "clienteId", "condicionPago", "condicionPagoCredito", "creditoResueltoEn", "creditoResueltoPor", "creditoSolicitadoEn", "descuentoTotal", "deudaCreditoEvaluada", "direccionEntrega", "empresaId", "estado", "estadoAprobacionCredito", "fecha", "fechaEntregaSolicitada", "fulfillmentVersion", "id", "igv", "limiteCreditoEvaluado", "moneda", "montoCreditoEvaluado", "motivoRechazoCredito", "notas", "numero", "ordenCompraCliente", "referenciaCliente", "requiereEntrega", "subtotalBruto", "tasaIgv", "tipoCambio", "total", "totalConIgv", "usuarioId", "usuarioNombre", "vendedorId") SELECT "almacenId", "clienteId", "condicionPago", "condicionPagoCredito", "creditoResueltoEn", "creditoResueltoPor", "creditoSolicitadoEn", "descuentoTotal", "deudaCreditoEvaluada", "direccionEntrega", "empresaId", "estado", "estadoAprobacionCredito", "fecha", "fechaEntregaSolicitada", "fulfillmentVersion", "id", "igv", "limiteCreditoEvaluado", "moneda", "montoCreditoEvaluado", "motivoRechazoCredito", "notas", "numero", "ordenCompraCliente", "referenciaCliente", "requiereEntrega", "subtotalBruto", "tasaIgv", "tipoCambio", "total", "totalConIgv", "usuarioId", "usuarioNombre", "vendedorId" FROM "pedidos";
DROP TABLE "pedidos";
ALTER TABLE "new_pedidos" RENAME TO "pedidos";
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");
CREATE TABLE "new_vendedores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tipo" TEXT NOT NULL,
    "tasaComision" DECIMAL NOT NULL,
    "zonaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vendedores_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_vendedores" ("activo", "creadoEn", "documento", "email", "empresaId", "id", "nombre", "tasaComision", "telefono", "tipo", "zonaId") SELECT "activo", "creadoEn", "documento", "email", "empresaId", "id", "nombre", "tasaComision", "telefono", "tipo", "zonaId" FROM "vendedores";
DROP TABLE "vendedores";
ALTER TABLE "new_vendedores" RENAME TO "vendedores";
CREATE TABLE "new_zonas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "zonas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_zonas" ("activo", "creadoEn", "empresaId", "id", "nombre") SELECT "activo", "creadoEn", "empresaId", "id", "nombre" FROM "zonas";
DROP TABLE "zonas";
ALTER TABLE "new_zonas" RENAME TO "zonas";
CREATE UNIQUE INDEX "zonas_empresaId_nombre_key" ON "zonas"("empresaId", "nombre");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
