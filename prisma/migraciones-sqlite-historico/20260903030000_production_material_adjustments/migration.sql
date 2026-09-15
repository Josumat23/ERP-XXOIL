CREATE TABLE "movimientos_material_produccion" (
  "id" TEXT NOT NULL PRIMARY KEY, "loteGranelId" TEXT NOT NULL, "insumoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL, "cantidad" DECIMAL NOT NULL, "costoUnitario" DECIMAL NOT NULL,
  "costoTotal" DECIMAL NOT NULL, "motivo" TEXT NOT NULL, "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL, "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movimientos_material_produccion_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "movimientos_material_produccion_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "movimientos_material_produccion_loteGranelId_creadoEn_idx" ON "movimientos_material_produccion"("loteGranelId", "creadoEn");
CREATE TABLE "devoluciones_asignacion_lote_insumo" (
  "id" TEXT NOT NULL PRIMARY KEY, "movimientoMaterialId" TEXT NOT NULL, "asignacionLoteInsumoId" TEXT NOT NULL,
  "cantidad" DECIMAL NOT NULL, "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "devoluciones_asignacion_lote_insumo_movimientoMaterialId_fkey" FOREIGN KEY ("movimientoMaterialId") REFERENCES "movimientos_material_produccion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "devoluciones_asignacion_lote_insumo_asignacionLoteInsumoId_fkey" FOREIGN KEY ("asignacionLoteInsumoId") REFERENCES "asignaciones_lote_insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "devoluciones_asignacion_lote_insumo_asignacionLoteInsumoId_idx" ON "devoluciones_asignacion_lote_insumo"("asignacionLoteInsumoId");
