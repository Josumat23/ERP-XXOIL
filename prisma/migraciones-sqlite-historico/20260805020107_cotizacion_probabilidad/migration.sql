-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "cotizaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cotizaciones" ("clienteId", "empresaId", "estado", "fecha", "id", "notas", "numero", "pedidoId", "total", "usuarioId", "usuarioNombre", "validaHasta", "vendedorId") SELECT "clienteId", "empresaId", "estado", "fecha", "id", "notas", "numero", "pedidoId", "total", "usuarioId", "usuarioNombre", "validaHasta", "vendedorId" FROM "cotizaciones";
DROP TABLE "cotizaciones";
ALTER TABLE "new_cotizaciones" RENAME TO "cotizaciones";
CREATE UNIQUE INDEX "cotizaciones_numero_key" ON "cotizaciones"("numero");
CREATE UNIQUE INDEX "cotizaciones_pedidoId_key" ON "cotizaciones"("pedidoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
