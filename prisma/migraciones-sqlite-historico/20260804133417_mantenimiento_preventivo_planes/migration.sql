-- CreateTable
CREATE TABLE "planes_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "equipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "frecuenciaDias" INTEGER,
    "frecuenciaContador" DECIMAL,
    "ultimaEjecucionFecha" DATETIME,
    "ultimaEjecucionContador" DECIMAL,
    "centroCostoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "contadorActual" DECIMAL NOT NULL DEFAULT 0,
    "unidadContador" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipos_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("activo", "activoFijoId", "almacenId", "centroCostoId", "codigo", "creadoEn", "empresaId", "id", "nombre", "notas") SELECT "activo", "activoFijoId", "almacenId", "centroCostoId", "codigo", "creadoEn", "empresaId", "id", "nombre", "notas" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
CREATE UNIQUE INDEX "equipos_activoFijoId_key" ON "equipos"("activoFijoId");
CREATE UNIQUE INDEX "equipos_empresaId_codigo_key" ON "equipos"("empresaId", "codigo");
CREATE TABLE "new_ordenes_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADA',
    "descripcion" TEXT NOT NULL,
    "fechaProgramada" DATETIME NOT NULL,
    "duracionDias" INTEGER NOT NULL DEFAULT 1,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoRepuestos" DECIMAL NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "centroCostoId" TEXT,
    "planMantenimientoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "planes_mantenimiento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ordenes_mantenimiento" ("centroCostoId", "codigo", "costoManoObra", "costoRepuestos", "creadoEn", "descripcion", "duracionDias", "equipoId", "estado", "fechaFin", "fechaInicio", "fechaProgramada", "id", "observaciones", "tipo", "usuarioId", "usuarioNombre") SELECT "centroCostoId", "codigo", "costoManoObra", "costoRepuestos", "creadoEn", "descripcion", "duracionDias", "equipoId", "estado", "fechaFin", "fechaInicio", "fechaProgramada", "id", "observaciones", "tipo", "usuarioId", "usuarioNombre" FROM "ordenes_mantenimiento";
DROP TABLE "ordenes_mantenimiento";
ALTER TABLE "new_ordenes_mantenimiento" RENAME TO "ordenes_mantenimiento";
CREATE UNIQUE INDEX "ordenes_mantenimiento_codigo_key" ON "ordenes_mantenimiento"("codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
