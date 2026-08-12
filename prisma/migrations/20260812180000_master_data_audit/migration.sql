-- CreateTable
CREATE TABLE "auditoria_maestros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "entidad" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valoresAntes" TEXT,
    "valoresDespues" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "auditoria_maestros_empresaId_entidad_registroId_creadoEn_idx" ON "auditoria_maestros"("empresaId", "entidad", "registroId", "creadoEn");
CREATE INDEX "auditoria_maestros_usuarioId_creadoEn_idx" ON "auditoria_maestros"("usuarioId", "creadoEn");