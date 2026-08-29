CREATE TABLE "factura_detalles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "facturaId" TEXT NOT NULL,
  "pedidoDetalleId" TEXT NOT NULL,
  "presentacionId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "precioLista" DECIMAL NOT NULL DEFAULT 0,
  "origenPrecio" TEXT NOT NULL DEFAULT 'LEGACY',
  "cantidadMinimaPrecio" INTEGER,
  "descuentoPct" DECIMAL NOT NULL DEFAULT 0,
  "descuentoMonto" DECIMAL NOT NULL DEFAULT 0,
  "precioUnitario" DECIMAL NOT NULL,
  "subtotal" DECIMAL NOT NULL,
  "precioUnitarioFuncional" DECIMAL NOT NULL DEFAULT 0,
  "subtotalFuncional" DECIMAL NOT NULL DEFAULT 0,
  "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
  CONSTRAINT "factura_detalles_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "factura_detalles_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "factura_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "factura_detalles" (
  "id", "facturaId", "pedidoDetalleId", "presentacionId", "cantidad",
  "precioLista", "origenPrecio", "cantidadMinimaPrecio", "descuentoPct",
  "descuentoMonto", "precioUnitario", "subtotal", "precioUnitarioFuncional",
  "subtotalFuncional", "costoUnitario"
)
SELECT
  'legacy-' || f."id" || '-' || d."id", f."id", d."id", d."presentacionId", d."cantidad",
  d."precioLista", d."origenPrecio", d."cantidadMinimaPrecio", d."descuentoPct",
  d."descuentoMonto", d."precioUnitario", d."subtotal",
  ROUND(d."precioUnitario" * f."tipoCambio", 2), ROUND(d."subtotal" * f."tipoCambio", 2),
  d."costoUnitario"
FROM "facturas" f
JOIN "pedido_detalles" d ON d."pedidoId" = f."pedidoId";
CREATE UNIQUE INDEX "factura_detalles_facturaId_pedidoDetalleId_key" ON "factura_detalles"("facturaId", "pedidoDetalleId");
CREATE INDEX "factura_detalles_pedidoDetalleId_idx" ON "factura_detalles"("pedidoDetalleId");
CREATE INDEX "factura_detalles_presentacionId_idx" ON "factura_detalles"("presentacionId");