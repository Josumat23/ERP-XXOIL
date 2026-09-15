-- CreateTable
CREATE TABLE "ubicaciones_tecnicas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentId" TEXT,
    "almacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ubicaciones_tecnicas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ubicaciones_tecnicas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ubicaciones_tecnicas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ubicaciones_tecnicas_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_equipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "activoFijoId" TEXT,
    "centroCostoId" TEXT,
    "centroTrabajoId" TEXT,
    "ubicacionTecnicaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "contadorActual" DECIMAL NOT NULL DEFAULT 0,
    "unidadContador" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipos_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_ubicacionTecnicaId_fkey" FOREIGN KEY ("ubicacionTecnicaId") REFERENCES "ubicaciones_tecnicas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("activo", "activoFijoId", "almacenId", "centroCostoId", "centroTrabajoId", "codigo", "contadorActual", "creadoEn", "empresaId", "id", "nombre", "notas", "unidadContador") SELECT "activo", "activoFijoId", "almacenId", "centroCostoId", "centroTrabajoId", "codigo", "contadorActual", "creadoEn", "empresaId", "id", "nombre", "notas", "unidadContador" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
CREATE UNIQUE INDEX "equipos_activoFijoId_key" ON "equipos"("activoFijoId");
CREATE UNIQUE INDEX "equipos_empresaId_codigo_key" ON "equipos"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ubicaciones_tecnicas_empresaId_parentId_idx" ON "ubicaciones_tecnicas"("empresaId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_tecnicas_empresaId_codigo_key" ON "ubicaciones_tecnicas"("empresaId", "codigo");

