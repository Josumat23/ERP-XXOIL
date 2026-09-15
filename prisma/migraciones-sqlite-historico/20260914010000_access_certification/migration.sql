-- Certificacion periodica de accesos.
--
-- Hasta ahora habia una ALERTA de inactividad a 90 dias en la pantalla de
-- usuarios. Certificar es que alguien declare por escrito que cada acceso
-- sigue siendo correcto, con constancia de quien lo dijo y cuando.
--
-- La campana CONGELA lo revisado: certificar contra datos vivos no certifica
-- nada. Tablas nuevas sin filas; ningun usuario ni permiso cambia.


-- CreateTable
CREATE TABLE "campanas_certificacion_accesos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "notas" TEXT,
    "abiertaPorId" TEXT NOT NULL,
    "abiertaPorNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" DATETIME,
    "completadaPorId" TEXT,
    "completadaPorNombre" TEXT,
    "motivoCancelacion" TEXT,
    CONSTRAINT "campanas_certificacion_accesos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificaciones_acceso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campanaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "grupoNombre" TEXT,
    "permisosResumen" TEXT NOT NULL,
    "conflictosSod" TEXT,
    "ultimoAccesoEn" DATETIME,
    "decision" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "revisadoPorId" TEXT,
    "revisadoPorNombre" TEXT,
    "revisadoEn" DATETIME,
    CONSTRAINT "certificaciones_acceso_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas_certificacion_accesos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "certificaciones_acceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "campanas_certificacion_accesos_empresaId_estado_idx" ON "campanas_certificacion_accesos"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "campanas_certificacion_accesos_empresaId_numero_key" ON "campanas_certificacion_accesos"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "certificaciones_acceso_usuarioId_idx" ON "certificaciones_acceso"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "certificaciones_acceso_campanaId_usuarioId_key" ON "certificaciones_acceso"("campanaId", "usuarioId");

