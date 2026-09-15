-- CreateTable
CREATE TABLE "posiciones_organizativas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "reportaAId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "posiciones_organizativas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "posiciones_organizativas_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "posiciones_organizativas_reportaAId_fkey" FOREIGN KEY ("reportaAId") REFERENCES "posiciones_organizativas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asignaciones_posicion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "posicionId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "vigenteDesde" DATETIME NOT NULL,
    "vigenteHasta" DATETIME,
    "motivo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asignaciones_posicion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_posicion_posicionId_fkey" FOREIGN KEY ("posicionId") REFERENCES "posiciones_organizativas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_posicion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "posiciones_organizativas_empresaId_activa_idx" ON "posiciones_organizativas"("empresaId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "posiciones_organizativas_empresaId_codigo_key" ON "posiciones_organizativas"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "asignaciones_posicion_empresaId_posicionId_vigenteDesde_idx" ON "asignaciones_posicion"("empresaId", "posicionId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "asignaciones_posicion_empresaId_empleadoId_vigenteDesde_idx" ON "asignaciones_posicion"("empresaId", "empleadoId", "vigenteDesde");

