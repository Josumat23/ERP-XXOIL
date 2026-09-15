-- CreateTable
CREATE TABLE "saldos_zona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zonaAlmacenId" TEXT NOT NULL,
    "tipoItem" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "cantidad" DECIMAL NOT NULL DEFAULT 0,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "saldos_zona_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "saldos_zona_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saldos_zona_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "saldos_zona_presentacionId_idx" ON "saldos_zona"("presentacionId");

-- CreateIndex
CREATE INDEX "saldos_zona_insumoId_idx" ON "saldos_zona"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_zona_zonaAlmacenId_itemId_key" ON "saldos_zona"("zonaAlmacenId", "itemId");

