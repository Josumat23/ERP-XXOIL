-- CreateTable
CREATE TABLE "proyectos" (
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
    CONSTRAINT "proyectos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "proyectos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "empleados" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "edt_proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "parentId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "presupuesto" DECIMAL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "edt_proyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "edt_proyecto_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "edt_proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "actividades_proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "edtId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionDias" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "responsableId" TEXT,
    "equipoId" TEXT,
    "fechaInicioPlan" DATETIME,
    "fechaFinPlan" DATETIME,
    "esCritica" BOOLEAN NOT NULL DEFAULT false,
    "holguraDias" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "actividades_proyecto_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "actividades_proyecto_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "empleados" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "actividades_proyecto_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "precedencias_actividad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actividadPredecesoraId" TEXT NOT NULL,
    "actividadSucesoraId" TEXT NOT NULL,
    CONSTRAINT "precedencias_actividad_actividadPredecesoraId_fkey" FOREIGN KEY ("actividadPredecesoraId") REFERENCES "actividades_proyecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "precedencias_actividad_actividadSucesoraId_fkey" FOREIGN KEY ("actividadSucesoraId") REFERENCES "actividades_proyecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "costos_proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "edtId" TEXT,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "costos_proyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "costos_proyecto_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "activos_fijos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activos_fijos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activos_fijos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_activos_fijos" ("activo", "almacenId", "categoria", "centroCostoId", "codigo", "costoAdquisicion", "creadoEn", "depreciacionAcumulada", "empresaId", "fechaAdquisicion", "fechaBaja", "id", "motivoBaja", "nombre", "notas", "precioVenta", "usuarioId", "usuarioNombre", "valorResidual", "vidaUtilAnios") SELECT "activo", "almacenId", "categoria", "centroCostoId", "codigo", "costoAdquisicion", "creadoEn", "depreciacionAcumulada", "empresaId", "fechaAdquisicion", "fechaBaja", "id", "motivoBaja", "nombre", "notas", "precioVenta", "usuarioId", "usuarioNombre", "valorResidual", "vidaUtilAnios" FROM "activos_fijos";
DROP TABLE "activos_fijos";
ALTER TABLE "new_activos_fijos" RENAME TO "activos_fijos";
CREATE UNIQUE INDEX "activos_fijos_empresaId_codigo_key" ON "activos_fijos"("empresaId", "codigo");
CREATE TABLE "new_ordenes_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "total" DECIMAL NOT NULL,
    "notas" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadaPor" TEXT,
    "aprobadaEn" DATETIME,
    "motivoRechazo" TEXT,
    "proyectoId" TEXT,
    "edtId" TEXT,
    CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_edtId_fkey" FOREIGN KEY ("edtId") REFERENCES "edt_proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ordenes_compra" ("almacenId", "aprobadaEn", "aprobadaPor", "empresaId", "estado", "estadoAprobacion", "fecha", "id", "moneda", "motivoAnulacion", "motivoRechazo", "notas", "numero", "proveedorId", "tipoCambio", "total", "usuarioId", "usuarioNombre") SELECT "almacenId", "aprobadaEn", "aprobadaPor", "empresaId", "estado", "estadoAprobacion", "fecha", "id", "moneda", "motivoAnulacion", "motivoRechazo", "notas", "numero", "proveedorId", "tipoCambio", "total", "usuarioId", "usuarioNombre" FROM "ordenes_compra";
DROP TABLE "ordenes_compra";
ALTER TABLE "new_ordenes_compra" RENAME TO "ordenes_compra";
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "precedencias_actividad_actividadPredecesoraId_actividadSucesoraId_key" ON "precedencias_actividad"("actividadPredecesoraId", "actividadSucesoraId");
