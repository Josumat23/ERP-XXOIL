CREATE TABLE "centros_trabajo" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "almacenId" TEXT NOT NULL,
  "centroCostoId" TEXT,
  "capacidadHorasDia" DECIMAL NOT NULL,
  "eficienciaPct" DECIMAL NOT NULL DEFAULT 100,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "centros_trabajo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "centros_trabajo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "centros_trabajo_empresaId_codigo_key" ON "centros_trabajo"("empresaId", "codigo");

ALTER TABLE "equipos" ADD COLUMN "centroTrabajoId" TEXT REFERENCES "centros_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "equipos_centroTrabajoId_idx" ON "equipos"("centroTrabajoId");
