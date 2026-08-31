ALTER TABLE "asignaciones_lote_venta" ADD COLUMN "devolucionDetalleId" TEXT REFERENCES "devolucion_cliente_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nota_credito_detalles" ADD COLUMN "devolucionDetalleId" TEXT REFERENCES "devolucion_cliente_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "devoluciones_cliente" (
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
  CONSTRAINT "devoluciones_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "devoluciones_cliente_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "devolucion_cliente_detalles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "devolucionId" TEXT NOT NULL,
  "facturaDetalleId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "cantidadReingreso" INTEGER NOT NULL DEFAULT 0,
  "cantidadDesecho" INTEGER NOT NULL DEFAULT 0,
  "cantidadDevolverCliente" INTEGER NOT NULL DEFAULT 0,
  "cantidadAcreditable" INTEGER NOT NULL DEFAULT 0,
  "observacionCalidad" TEXT,
  "inspeccionadaEn" DATETIME,
  "inspeccionadaPorId" TEXT,
  "inspeccionadaPorNombre" TEXT,
  CONSTRAINT "devolucion_cliente_detalles_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "devolucion_cliente_detalles_facturaDetalleId_fkey" FOREIGN KEY ("facturaDetalleId") REFERENCES "factura_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "devoluciones_cliente_numero_key" ON "devoluciones_cliente"("numero");
CREATE INDEX "devoluciones_cliente_facturaId_idx" ON "devoluciones_cliente"("facturaId");
CREATE INDEX "devoluciones_cliente_almacenId_estado_idx" ON "devoluciones_cliente"("almacenId", "estado");
CREATE UNIQUE INDEX "devolucion_cliente_detalles_devolucionId_facturaDetalleId_key" ON "devolucion_cliente_detalles"("devolucionId", "facturaDetalleId");
CREATE INDEX "devolucion_cliente_detalles_facturaDetalleId_idx" ON "devolucion_cliente_detalles"("facturaDetalleId");
CREATE INDEX "asignaciones_lote_venta_devolucionDetalleId_idx" ON "asignaciones_lote_venta"("devolucionDetalleId");
CREATE INDEX "nota_credito_detalles_devolucionDetalleId_idx" ON "nota_credito_detalles"("devolucionDetalleId");