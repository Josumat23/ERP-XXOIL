-- CreateTable
CREATE TABLE "parametros_planilla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "rmv" DECIMAL NOT NULL,
    "uit" DECIMAL NOT NULL,
    "tasaEsSalud" DECIMAL NOT NULL DEFAULT 9,
    "tasaOnp" DECIMAL NOT NULL DEFAULT 13,
    "vigenteDesde" DATETIME NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tasas_afp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "afp" TEXT NOT NULL,
    "tipoComision" TEXT NOT NULL DEFAULT 'FLUJO',
    "tasaAporteObligatorio" DECIMAL NOT NULL DEFAULT 10,
    "tasaComision" DECIMAL NOT NULL,
    "primaSeguro" DECIMAL NOT NULL,
    "vigenteDesde" DATETIME NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "planilla_periodos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'MENSUAL',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" DATETIME
);

-- CreateTable
CREATE TABLE "planilla_detalles" (
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
    "neto" DECIMAL NOT NULL,
    "asientoNumero" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planilla_detalles_planillaPeriodoId_fkey" FOREIGN KEY ("planillaPeriodoId") REFERENCES "planilla_periodos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planilla_detalles_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_empleados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "tipoDocumentoIdentidad" TEXT NOT NULL DEFAULT 'DNI',
    "dni" TEXT,
    "nacionalidad" TEXT NOT NULL DEFAULT 'Peruana',
    "fechaNacimiento" DATETIME,
    "fechaIngreso" DATETIME NOT NULL,
    "fechaCese" DATETIME,
    "motivoCese" TEXT,
    "cargo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "tipoContrato" TEXT NOT NULL,
    "sueldoBasico" DECIMAL NOT NULL DEFAULT 0,
    "telefono" TEXT,
    "correo" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "almacenId" TEXT,
    "centroCostoId" TEXT,
    "usuarioId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "sistemaPension" TEXT,
    "afp" TEXT,
    "asignacionFamiliar" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "empleados_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_empleados" ("almacenId", "apellidos", "area", "banco", "cargo", "cci", "centroCostoId", "codigo", "correo", "creadoEn", "dni", "empresaId", "estado", "fechaCese", "fechaIngreso", "fechaNacimiento", "iban", "id", "motivoCese", "nacionalidad", "nombres", "notas", "numeroCuenta", "sueldoBasico", "swift", "telefono", "tipoContrato", "tipoDocumentoIdentidad", "usuarioId") SELECT "almacenId", "apellidos", "area", "banco", "cargo", "cci", "centroCostoId", "codigo", "correo", "creadoEn", "dni", "empresaId", "estado", "fechaCese", "fechaIngreso", "fechaNacimiento", "iban", "id", "motivoCese", "nacionalidad", "nombres", "notas", "numeroCuenta", "sueldoBasico", "swift", "telefono", "tipoContrato", "tipoDocumentoIdentidad", "usuarioId" FROM "empleados";
DROP TABLE "empleados";
ALTER TABLE "new_empleados" RENAME TO "empleados";
CREATE UNIQUE INDEX "empleados_usuarioId_key" ON "empleados"("usuarioId");
CREATE UNIQUE INDEX "empleados_empresaId_codigo_key" ON "empleados"("empresaId", "codigo");
CREATE UNIQUE INDEX "empleados_empresaId_dni_key" ON "empleados"("empresaId", "dni");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "tasas_afp_afp_tipoComision_vigenteDesde_key" ON "tasas_afp"("afp", "tipoComision", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "planilla_periodos_empresaId_anio_mes_tipo_key" ON "planilla_periodos"("empresaId", "anio", "mes", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "planilla_detalles_planillaPeriodoId_empleadoId_key" ON "planilla_detalles"("planillaPeriodoId", "empleadoId");
