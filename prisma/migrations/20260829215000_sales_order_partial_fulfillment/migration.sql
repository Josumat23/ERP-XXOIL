-- Token de concurrencia para impedir sobrefacturación de saldos por línea.
ALTER TABLE "pedidos" ADD COLUMN "fulfillmentVersion" INTEGER NOT NULL DEFAULT 0;

-- Un pedido puede originar varias facturas parciales.
DROP INDEX "facturas_pedidoId_key";
CREATE INDEX "facturas_pedidoId_idx" ON "facturas"("pedidoId");

-- Cada evento de lote queda asociado a la línea de factura que lo originó.
ALTER TABLE "asignaciones_lote_venta" ADD COLUMN "facturaDetalleId" TEXT REFERENCES "factura_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hasta esta migración cada pedido tenía una sola factura, por lo que el
-- vínculo histórico se puede reconstruir sin ambigüedad.
UPDATE "asignaciones_lote_venta"
SET "facturaDetalleId" = (
  SELECT "fd"."id"
  FROM "factura_detalles" AS "fd"
  WHERE "fd"."pedidoDetalleId" = "asignaciones_lote_venta"."pedidoDetalleId"
  LIMIT 1
);

CREATE INDEX "asignaciones_lote_venta_facturaDetalleId_idx"
ON "asignaciones_lote_venta"("facturaDetalleId");
