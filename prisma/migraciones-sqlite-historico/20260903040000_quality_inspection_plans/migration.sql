-- Planes de inspección versionados y evidencia analítica inmutable por lote.
CREATE TABLE "planes_inspeccion_calidad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "productoId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "vigenteDesde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vigenteHasta" DATETIME,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "planes_inspeccion_calidad_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "planes_inspeccion_calidad_productoId_version_key" ON "planes_inspeccion_calidad"("productoId", "version");
CREATE INDEX "planes_inspeccion_calidad_empresaId_activo_idx" ON "planes_inspeccion_calidad"("empresaId", "activo");

CREATE TABLE "caracteristicas_plan_calidad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "secuencia" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "unidadMedida" TEXT NOT NULL,
  "limiteInferior" DECIMAL,
  "limiteSuperior" DECIMAL,
  "metodoEnsayo" TEXT,
  "obligatoria" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "caracteristicas_plan_calidad_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_inspeccion_calidad" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "caracteristicas_plan_calidad_planId_secuencia_key" ON "caracteristicas_plan_calidad"("planId", "secuencia");

ALTER TABLE "controles_calidad" ADD COLUMN "planInspeccionId" TEXT REFERENCES "planes_inspeccion_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "controles_calidad" ADD COLUMN "planVersion" INTEGER;

CREATE TABLE "resultados_caracteristica_calidad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "controlCalidadId" TEXT NOT NULL,
  "secuencia" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "unidadMedida" TEXT NOT NULL,
  "limiteInferior" DECIMAL,
  "limiteSuperior" DECIMAL,
  "metodoEnsayo" TEXT,
  "valorMedido" DECIMAL NOT NULL,
  "conforme" BOOLEAN NOT NULL,
  CONSTRAINT "resultados_caracteristica_calidad_controlCalidadId_fkey" FOREIGN KEY ("controlCalidadId") REFERENCES "controles_calidad" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "resultados_caracteristica_calidad_controlCalidadId_secuencia_key" ON "resultados_caracteristica_calidad"("controlCalidadId", "secuencia");
