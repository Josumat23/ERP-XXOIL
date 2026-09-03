CREATE TABLE "no_conformidades_calidad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "controlCalidadId" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
  "contencionInmediata" TEXT,
  "causaRaizConfirmada" TEXT,
  "accionCorrectiva" TEXT,
  "responsableId" TEXT,
  "responsableNombre" TEXT,
  "fechaCompromiso" DATETIME,
  "verificacionEficacia" TEXT,
  "eficaz" BOOLEAN,
  "cerradoEn" DATETIME,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" DATETIME NOT NULL,
  CONSTRAINT "no_conformidades_calidad_controlCalidadId_fkey" FOREIGN KEY ("controlCalidadId") REFERENCES "controles_calidad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "no_conformidades_calidad_controlCalidadId_key" ON "no_conformidades_calidad"("controlCalidadId");
CREATE INDEX "no_conformidades_calidad_empresaId_estado_fechaCompromiso_idx" ON "no_conformidades_calidad"("empresaId", "estado", "fechaCompromiso");

CREATE TABLE "eventos_no_conformidad_calidad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "noConformidadId" TEXT NOT NULL,
  "estadoAnterior" TEXT,
  "estadoNuevo" TEXT NOT NULL,
  "comentario" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_no_conformidad_calidad_noConformidadId_fkey" FOREIGN KEY ("noConformidadId") REFERENCES "no_conformidades_calidad" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "eventos_no_conformidad_calidad_noConformidadId_creadoEn_idx" ON "eventos_no_conformidad_calidad"("noConformidadId", "creadoEn");
