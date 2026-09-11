-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_centros_costo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "almacenId" TEXT,
    "parentId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "centros_costo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "centros_costo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "centros_costo_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_centros_costo" ("activo", "almacenId", "codigo", "creadoEn", "empresaId", "id", "nombre", "parentId", "tipo") SELECT "activo", "almacenId", "codigo", "creadoEn", "empresaId", "id", "nombre", "parentId", "tipo" FROM "centros_costo";
DROP TABLE "centros_costo";
ALTER TABLE "new_centros_costo" RENAME TO "centros_costo";
CREATE INDEX "centros_costo_parentId_idx" ON "centros_costo"("parentId");
CREATE UNIQUE INDEX "centros_costo_empresaId_codigo_key" ON "centros_costo"("empresaId", "codigo");
CREATE TABLE "new_ordenes_internas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "presupuesto" DECIMAL,
    "totalAcumulado" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLiquidacion" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_internas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_internas_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ordenes_internas" ("centroCostoId", "codigo", "creadoEn", "descripcion", "empresaId", "estado", "fechaInicio", "fechaLiquidacion", "id", "presupuesto", "totalAcumulado", "usuarioId", "usuarioNombre") SELECT "centroCostoId", "codigo", "creadoEn", "descripcion", "empresaId", "estado", "fechaInicio", "fechaLiquidacion", "id", "presupuesto", "totalAcumulado", "usuarioId", "usuarioNombre" FROM "ordenes_internas";
DROP TABLE "ordenes_internas";
ALTER TABLE "new_ordenes_internas" RENAME TO "ordenes_internas";
CREATE UNIQUE INDEX "ordenes_internas_codigo_key" ON "ordenes_internas"("codigo");
CREATE TABLE "new_centro_costo_controles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clave" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "reglaId" TEXT,
    CONSTRAINT "centro_costo_controles_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "centro_costo_controles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "centro_costo_controles_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_asignacion_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_centro_costo_controles" ("centroCostoId", "clave", "empresaId", "id", "reglaId") SELECT "centroCostoId", "clave", "empresaId", "id", "reglaId" FROM "centro_costo_controles";
DROP TABLE "centro_costo_controles";
ALTER TABLE "new_centro_costo_controles" RENAME TO "centro_costo_controles";
CREATE UNIQUE INDEX "centro_costo_controles_empresaId_clave_key" ON "centro_costo_controles"("empresaId", "clave");
CREATE TABLE "new_activos_fijos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "almacenId" TEXT,
    "fechaAdquisicion" DATETIME NOT NULL,
    "costoAdquisicion" DECIMAL NOT NULL,
    "valorResidual" DECIMAL NOT NULL DEFAULT 0,
    "vidaUtilAnios" INTEGER NOT NULL,
    "depreciacionAcumulada" DECIMAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" DATETIME,
    "motivoBaja" TEXT,
    "precioVenta" DECIMAL,
    "notas" TEXT,
    "centroCostoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proyectoId" TEXT,
    CONSTRAINT "activos_fijos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activos_fijos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activos_fijos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activos_fijos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_activos_fijos" ("activo", "almacenId", "categoria", "centroCostoId", "codigo", "costoAdquisicion", "creadoEn", "depreciacionAcumulada", "empresaId", "fechaAdquisicion", "fechaBaja", "id", "motivoBaja", "nombre", "notas", "precioVenta", "proyectoId", "usuarioId", "usuarioNombre", "valorResidual", "vidaUtilAnios") SELECT "activo", "almacenId", "categoria", "centroCostoId", "codigo", "costoAdquisicion", "creadoEn", "depreciacionAcumulada", "empresaId", "fechaAdquisicion", "fechaBaja", "id", "motivoBaja", "nombre", "notas", "precioVenta", "proyectoId", "usuarioId", "usuarioNombre", "valorResidual", "vidaUtilAnios" FROM "activos_fijos";
DROP TABLE "activos_fijos";
ALTER TABLE "new_activos_fijos" RENAME TO "activos_fijos";
CREATE UNIQUE INDEX "activos_fijos_empresaId_codigo_key" ON "activos_fijos"("empresaId", "codigo");
CREATE TABLE "new_proyectos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "centroCostoId" TEXT,
    "presupuestoTotal" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "fechaInicioPlan" DATETIME NOT NULL,
    "fechaFinPlan" DATETIME NOT NULL,
    "fechaInicioReal" DATETIME,
    "fechaFinReal" DATETIME,
    "responsableId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proyectos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "proyectos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "proyectos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "empleados" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_proyectos" ("centroCostoId", "codigo", "creadoEn", "descripcion", "empresaId", "estado", "fechaFinPlan", "fechaFinReal", "fechaInicioPlan", "fechaInicioReal", "id", "nombre", "presupuestoTotal", "responsableId", "usuarioId", "usuarioNombre") SELECT "centroCostoId", "codigo", "creadoEn", "descripcion", "empresaId", "estado", "fechaFinPlan", "fechaFinReal", "fechaInicioPlan", "fechaInicioReal", "id", "nombre", "presupuestoTotal", "responsableId", "usuarioId", "usuarioNombre" FROM "proyectos";
DROP TABLE "proyectos";
ALTER TABLE "new_proyectos" RENAME TO "proyectos";
CREATE UNIQUE INDEX "proyectos_empresaId_codigo_key" ON "proyectos"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
