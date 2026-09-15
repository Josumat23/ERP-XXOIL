CREATE TABLE "formula_operaciones" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "formulaId" TEXT NOT NULL,
  "centroTrabajoId" TEXT NOT NULL,
  "secuencia" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "preparacionHoras" DECIMAL NOT NULL DEFAULT 0,
  "maquinaHoras" DECIMAL NOT NULL DEFAULT 0,
  "manoObraHoras" DECIMAL NOT NULL DEFAULT 0,
  CONSTRAINT "formula_operaciones_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "formula_operaciones_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "formula_operaciones_formulaId_secuencia_key" ON "formula_operaciones"("formulaId", "secuencia");

CREATE TABLE "lote_operaciones" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loteGranelId" TEXT NOT NULL,
  "formulaOperacionId" TEXT,
  "centroTrabajoId" TEXT NOT NULL,
  "equipoId" TEXT,
  "secuencia" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "preparacionPlanHoras" DECIMAL NOT NULL DEFAULT 0,
  "maquinaPlanHoras" DECIMAL NOT NULL DEFAULT 0,
  "manoObraPlanHoras" DECIMAL NOT NULL DEFAULT 0,
  "preparacionRealHoras" DECIMAL NOT NULL DEFAULT 0,
  "maquinaRealHoras" DECIMAL NOT NULL DEFAULT 0,
  "manoObraRealHoras" DECIMAL NOT NULL DEFAULT 0,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "inicioEn" DATETIME,
  "finEn" DATETIME,
  "usuarioInicioId" TEXT,
  "usuarioInicioNombre" TEXT,
  "usuarioFinId" TEXT,
  "usuarioFinNombre" TEXT,
  CONSTRAINT "lote_operaciones_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lote_operaciones_formulaOperacionId_fkey" FOREIGN KEY ("formulaOperacionId") REFERENCES "formula_operaciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "lote_operaciones_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lote_operaciones_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "lote_operaciones_loteGranelId_secuencia_key" ON "lote_operaciones"("loteGranelId", "secuencia");
CREATE INDEX "lote_operaciones_centroTrabajoId_estado_idx" ON "lote_operaciones"("centroTrabajoId", "estado");
