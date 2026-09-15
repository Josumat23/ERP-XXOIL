ALTER TABLE "pedidos" ADD COLUMN "subtotalBruto" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "pedidos" ADD COLUMN "descuentoTotal" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "pedidos" ADD COLUMN "tasaIgv" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "pedidos" ADD COLUMN "igv" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "pedidos" ADD COLUMN "totalConIgv" DECIMAL NOT NULL DEFAULT 0;

ALTER TABLE "pedido_detalles" ADD COLUMN "precioLista" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "pedido_detalles" ADD COLUMN "origenPrecio" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "pedido_detalles" ADD COLUMN "cantidadMinimaPrecio" INTEGER;
ALTER TABLE "pedido_detalles" ADD COLUMN "descuentoPct" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "pedido_detalles" ADD COLUMN "descuentoMonto" DECIMAL NOT NULL DEFAULT 0;

UPDATE "pedidos"
SET "subtotalBruto" = "total",
    "descuentoTotal" = 0,
    "tasaIgv" = COALESCE((SELECT "tasaIgv" FROM "configuracion_empresa" WHERE "id" = '1'), 18),
    "igv" = ROUND("total" * COALESCE((SELECT "tasaIgv" FROM "configuracion_empresa" WHERE "id" = '1'), 18) / 100, 2),
    "totalConIgv" = ROUND("total" + "total" * COALESCE((SELECT "tasaIgv" FROM "configuracion_empresa" WHERE "id" = '1'), 18) / 100, 2);

UPDATE "pedido_detalles"
SET "precioLista" = "precioUnitario",
    "origenPrecio" = 'LEGACY',
    "descuentoPct" = 0,
    "descuentoMonto" = 0;