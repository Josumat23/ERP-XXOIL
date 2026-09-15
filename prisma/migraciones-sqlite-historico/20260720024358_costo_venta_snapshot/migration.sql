-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pedido_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "pedido_detalles_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedido_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_pedido_detalles" ("cantidad", "id", "pedidoId", "precioUnitario", "presentacionId", "subtotal") SELECT "cantidad", "id", "pedidoId", "precioUnitario", "presentacionId", "subtotal" FROM "pedido_detalles";
DROP TABLE "pedido_detalles";
ALTER TABLE "new_pedido_detalles" RENAME TO "pedido_detalles";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
