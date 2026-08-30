-- Los pedidos históricos conservan facturación directa; los nuevos activan
-- entrega obligatoria explícitamente desde la acción de creación.
ALTER TABLE "pedidos" ADD COLUMN "requiereEntrega" BOOLEAN NOT NULL DEFAULT false;

-- La guía pasa a ser el documento logístico fuente del pedido.
ALTER TABLE "guias_remision" ADD COLUMN "pedidoId" TEXT REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "guias_remision"
SET "pedidoId" = (
  SELECT "f"."pedidoId" FROM "facturas" AS "f"
  WHERE "f"."id" = "guias_remision"."facturaId"
)
WHERE "facturaId" IS NOT NULL;
CREATE INDEX "guias_remision_pedidoId_idx" ON "guias_remision"("pedidoId");

-- Cada línea entregada conserva la línea exacta del pedido; la presentación
-- sola no basta para un flujo documental auditable.
ALTER TABLE "guia_remision_detalles" ADD COLUMN "pedidoDetalleId" TEXT REFERENCES "pedido_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guia_remision_detalles" ADD COLUMN "costoUnitario" DECIMAL NOT NULL DEFAULT 0;
UPDATE "guia_remision_detalles"
SET "pedidoDetalleId" = (
  SELECT "fd"."pedidoDetalleId"
  FROM "factura_detalles" AS "fd"
  JOIN "guias_remision" AS "g" ON "g"."facturaId" = "fd"."facturaId"
  WHERE "g"."id" = "guia_remision_detalles"."guiaId"
    AND "fd"."presentacionId" = "guia_remision_detalles"."presentacionId"
  LIMIT 1
);
CREATE INDEX "guia_remision_detalles_pedidoDetalleId_idx"
ON "guia_remision_detalles"("pedidoDetalleId");

-- Los nuevos movimientos de lote nacen en la salida logística. Los eventos
-- históricos permanecen asociados a FacturaDetalle para conservar su origen.
ALTER TABLE "asignaciones_lote_venta" ADD COLUMN "guiaDetalleId" TEXT REFERENCES "guia_remision_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "asignaciones_lote_venta_guiaDetalleId_idx"
ON "asignaciones_lote_venta"("guiaDetalleId");

-- Flujo documental N:M: una factura puede consolidar varias entregas y una
-- entrega puede facturarse en varios documentos parciales.
CREATE TABLE "factura_detalle_entregas" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "facturaDetalleId" TEXT NOT NULL,
  "guiaDetalleId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  CONSTRAINT "factura_detalle_entregas_facturaDetalleId_fkey" FOREIGN KEY ("facturaDetalleId") REFERENCES "factura_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "factura_detalle_entregas_guiaDetalleId_fkey" FOREIGN KEY ("guiaDetalleId") REFERENCES "guia_remision_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "factura_detalle_entregas_facturaDetalleId_guiaDetalleId_key"
ON "factura_detalle_entregas"("facturaDetalleId", "guiaDetalleId");
CREATE INDEX "factura_detalle_entregas_guiaDetalleId_idx"
ON "factura_detalle_entregas"("guiaDetalleId");