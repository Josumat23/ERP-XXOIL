-- CreateTable
CREATE TABLE "liquidaciones_desvinculacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "fechaCese" DATETIME NOT NULL,
    "ctsTruncada" DECIMAL NOT NULL,
    "gratificacionTruncada" DECIMAL NOT NULL,
    "bonificacionExtraordinaria" DECIMAL NOT NULL,
    "diasVacacionesPendientes" DECIMAL NOT NULL,
    "montoVacaciones" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "asientoNumero" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "liquidaciones_desvinculacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_planilla_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planillaPeriodoId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "sueldoBasico" DECIMAL NOT NULL,
    "asignacionFamiliar" DECIMAL NOT NULL DEFAULT 0,
    "remuneracionComputable" DECIMAL NOT NULL,
    "descuentoPension" DECIMAL NOT NULL DEFAULT 0,
    "detallePension" TEXT,
    "essaludPatronal" DECIMAL NOT NULL DEFAULT 0,
    "retencion5ta" DECIMAL NOT NULL DEFAULT 0,
    "mesesComputados" DECIMAL,
    "bonificacionExtraordinaria" DECIMAL NOT NULL DEFAULT 0,
    "neto" DECIMAL NOT NULL,
    "asientoNumero" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planilla_detalles_planillaPeriodoId_fkey" FOREIGN KEY ("planillaPeriodoId") REFERENCES "planilla_periodos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planilla_detalles_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_planilla_detalles" ("asientoNumero", "asignacionFamiliar", "creadoEn", "descuentoPension", "detallePension", "empleadoId", "essaludPatronal", "id", "neto", "planillaPeriodoId", "remuneracionComputable", "retencion5ta", "sueldoBasico") SELECT "asientoNumero", "asignacionFamiliar", "creadoEn", "descuentoPension", "detallePension", "empleadoId", "essaludPatronal", "id", "neto", "planillaPeriodoId", "remuneracionComputable", "retencion5ta", "sueldoBasico" FROM "planilla_detalles";
DROP TABLE "planilla_detalles";
ALTER TABLE "new_planilla_detalles" RENAME TO "planilla_detalles";
CREATE UNIQUE INDEX "planilla_detalles_planillaPeriodoId_empleadoId_key" ON "planilla_detalles"("planillaPeriodoId", "empleadoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_desvinculacion_empleadoId_key" ON "liquidaciones_desvinculacion"("empleadoId");
