-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_centros_trabajo" (
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
    CONSTRAINT "centros_trabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "centros_trabajo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "centros_trabajo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_centros_trabajo" ("activo", "almacenId", "capacidadHorasDia", "centroCostoId", "codigo", "creadoEn", "eficienciaPct", "empresaId", "id", "nombre", "tipo") SELECT "activo", "almacenId", "capacidadHorasDia", "centroCostoId", "codigo", "creadoEn", "eficienciaPct", "empresaId", "id", "nombre", "tipo" FROM "centros_trabajo";
DROP TABLE "centros_trabajo";
ALTER TABLE "new_centros_trabajo" RENAME TO "centros_trabajo";
CREATE UNIQUE INDEX "centros_trabajo_empresaId_codigo_key" ON "centros_trabajo"("empresaId", "codigo");
CREATE TABLE "new_equipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "activoFijoId" TEXT,
    "centroCostoId" TEXT,
    "centroTrabajoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "contadorActual" DECIMAL NOT NULL DEFAULT 0,
    "unidadContador" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipos_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_centroTrabajoId_fkey" FOREIGN KEY ("centroTrabajoId") REFERENCES "centros_trabajo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("activo", "activoFijoId", "almacenId", "centroCostoId", "centroTrabajoId", "codigo", "contadorActual", "creadoEn", "empresaId", "id", "nombre", "notas", "unidadContador") SELECT "activo", "activoFijoId", "almacenId", "centroCostoId", "centroTrabajoId", "codigo", "contadorActual", "creadoEn", "empresaId", "id", "nombre", "notas", "unidadContador" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
CREATE UNIQUE INDEX "equipos_activoFijoId_key" ON "equipos"("activoFijoId");
CREATE UNIQUE INDEX "equipos_empresaId_codigo_key" ON "equipos"("empresaId", "codigo");
CREATE TABLE "new_avisos_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "equipoId" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "titulo" TEXT NOT NULL,
    "sintoma" TEXT NOT NULL,
    "equipoDetenido" BOOLEAN NOT NULL DEFAULT false,
    "fechaDeteccion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descartadoEn" DATETIME,
    "motivoDescarte" TEXT,
    CONSTRAINT "avisos_mantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "avisos_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_avisos_mantenimiento" ("creadoEn", "descartadoEn", "empresaId", "equipoDetenido", "equipoId", "estado", "fechaDeteccion", "id", "motivoDescarte", "prioridad", "sintoma", "titulo", "usuarioId", "usuarioNombre") SELECT "creadoEn", "descartadoEn", "empresaId", "equipoDetenido", "equipoId", "estado", "fechaDeteccion", "id", "motivoDescarte", "prioridad", "sintoma", "titulo", "usuarioId", "usuarioNombre" FROM "avisos_mantenimiento";
DROP TABLE "avisos_mantenimiento";
ALTER TABLE "new_avisos_mantenimiento" RENAME TO "avisos_mantenimiento";
CREATE INDEX "avisos_mantenimiento_empresaId_estado_prioridad_idx" ON "avisos_mantenimiento"("empresaId", "estado", "prioridad");
CREATE TABLE "new_planes_mantenimiento" (
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
    CONSTRAINT "planes_mantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_planes_mantenimiento" ("activo", "centroCostoId", "creadoEn", "empresaId", "equipoId", "frecuenciaContador", "frecuenciaDias", "id", "nombre", "tipo", "ultimaEjecucionContador", "ultimaEjecucionFecha", "usuarioId", "usuarioNombre") SELECT "activo", "centroCostoId", "creadoEn", "empresaId", "equipoId", "frecuenciaContador", "frecuenciaDias", "id", "nombre", "tipo", "ultimaEjecucionContador", "ultimaEjecucionFecha", "usuarioId", "usuarioNombre" FROM "planes_mantenimiento";
DROP TABLE "planes_mantenimiento";
ALTER TABLE "new_planes_mantenimiento" RENAME TO "planes_mantenimiento";
CREATE TABLE "new_proyecciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "anioBase" INTEGER NOT NULL,
    "trimestreBase" INTEGER NOT NULL,
    "crecimientoMercadoPct" DECIMAL NOT NULL DEFAULT 0,
    "factorCompetenciaPct" DECIMAL NOT NULL DEFAULT 0,
    "presupuestoPublicidad" DECIMAL NOT NULL DEFAULT 0,
    "cajaMinimaDeseada" DECIMAL NOT NULL DEFAULT 0,
    "metaUtilidadOperativa" DECIMAL,
    "macroPbiManufacturaVar" DECIMAL,
    "macroInflacionVar" DECIMAL,
    "macroTipoCambio" DECIMAL,
    "macroActualizadoEn" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "proyecciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_proyecciones" ("actualizadoEn", "anio", "anioBase", "cajaMinimaDeseada", "creadoEn", "crecimientoMercadoPct", "empresaId", "factorCompetenciaPct", "id", "macroActualizadoEn", "macroInflacionVar", "macroPbiManufacturaVar", "macroTipoCambio", "metaUtilidadOperativa", "presupuestoPublicidad", "trimestre", "trimestreBase", "usuarioId", "usuarioNombre") SELECT "actualizadoEn", "anio", "anioBase", "cajaMinimaDeseada", "creadoEn", "crecimientoMercadoPct", "empresaId", "factorCompetenciaPct", "id", "macroActualizadoEn", "macroInflacionVar", "macroPbiManufacturaVar", "macroTipoCambio", "metaUtilidadOperativa", "presupuestoPublicidad", "trimestre", "trimestreBase", "usuarioId", "usuarioNombre" FROM "proyecciones";
DROP TABLE "proyecciones";
ALTER TABLE "new_proyecciones" RENAME TO "proyecciones";
CREATE UNIQUE INDEX "proyecciones_empresaId_anio_trimestre_key" ON "proyecciones"("empresaId", "anio", "trimestre");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
