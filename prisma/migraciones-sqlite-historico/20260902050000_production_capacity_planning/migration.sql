ALTER TABLE "lote_operaciones" ADD COLUMN "fechaPlanInicio" DATETIME;
ALTER TABLE "lote_operaciones" ADD COLUMN "fechaPlanFin" DATETIME;
CREATE INDEX "lote_operaciones_fechaPlanInicio_fechaPlanFin_idx" ON "lote_operaciones"("fechaPlanInicio", "fechaPlanFin");
