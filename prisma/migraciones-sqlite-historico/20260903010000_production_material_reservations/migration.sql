CREATE TABLE "reservas_insumo_produccion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loteGranelId" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "cantidad" DECIMAL NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservas_insumo_produccion_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reservas_insumo_produccion_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "reservas_insumo_produccion_loteGranelId_insumoId_key" ON "reservas_insumo_produccion"("loteGranelId", "insumoId");
CREATE INDEX "reservas_insumo_produccion_insumoId_idx" ON "reservas_insumo_produccion"("insumoId");
