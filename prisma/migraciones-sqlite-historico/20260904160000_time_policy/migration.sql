CREATE TABLE "politicas_tiempo_trabajo" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "vigenteDesde" DATETIME NOT NULL,
  "horasJornadaDiaria" DECIMAL NOT NULL DEFAULT 8,
  "primerasHorasRecargo" DECIMAL NOT NULL DEFAULT 2,
  "recargoPrimerTramo" DECIMAL NOT NULL DEFAULT 25,
  "recargoSegundoTramo" DECIMAL NOT NULL DEFAULT 35,
  "aplicarPagoSobretiempo" BOOLEAN NOT NULL DEFAULT false,
  "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "aprobadoEn" DATETIME,
  "aprobadoPorId" TEXT,
  "aprobadoPorNombre" TEXT,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "politicas_tiempo_trabajo_empresaId_vigenteDesde_key" ON "politicas_tiempo_trabajo"("empresaId", "vigenteDesde");
CREATE INDEX "politicas_tiempo_trabajo_empresaId_estado_vigenteDesde_idx" ON "politicas_tiempo_trabajo"("empresaId", "estado", "vigenteDesde");
