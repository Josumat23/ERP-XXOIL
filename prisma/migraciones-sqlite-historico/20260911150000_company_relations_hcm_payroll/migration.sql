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
    "turnoTrabajoId" TEXT,
    "jefeDirectoId" TEXT,
    CONSTRAINT "empleados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "empleados_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_turnoTrabajoId_fkey" FOREIGN KEY ("turnoTrabajoId") REFERENCES "turnos_trabajo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_jefeDirectoId_fkey" FOREIGN KEY ("jefeDirectoId") REFERENCES "empleados" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_empleados" ("afp", "almacenId", "apellidos", "area", "asignacionFamiliar", "banco", "cargo", "cci", "centroCostoId", "codigo", "correo", "creadoEn", "dni", "empresaId", "estado", "fechaCese", "fechaIngreso", "fechaNacimiento", "iban", "id", "jefeDirectoId", "motivoCese", "nacionalidad", "nombres", "notas", "numeroCuenta", "sistemaPension", "sueldoBasico", "swift", "telefono", "tipoContrato", "tipoDocumentoIdentidad", "turnoTrabajoId", "usuarioId") SELECT "afp", "almacenId", "apellidos", "area", "asignacionFamiliar", "banco", "cargo", "cci", "centroCostoId", "codigo", "correo", "creadoEn", "dni", "empresaId", "estado", "fechaCese", "fechaIngreso", "fechaNacimiento", "iban", "id", "jefeDirectoId", "motivoCese", "nacionalidad", "nombres", "notas", "numeroCuenta", "sistemaPension", "sueldoBasico", "swift", "telefono", "tipoContrato", "tipoDocumentoIdentidad", "turnoTrabajoId", "usuarioId" FROM "empleados";
DROP TABLE "empleados";
ALTER TABLE "new_empleados" RENAME TO "empleados";
CREATE UNIQUE INDEX "empleados_usuarioId_key" ON "empleados"("usuarioId");
CREATE INDEX "empleados_jefeDirectoId_idx" ON "empleados"("jefeDirectoId");
CREATE UNIQUE INDEX "empleados_empresaId_codigo_key" ON "empleados"("empresaId", "codigo");
CREATE UNIQUE INDEX "empleados_empresaId_dni_key" ON "empleados"("empresaId", "dni");
CREATE TABLE "new_turnos_trabajo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "finMinuto" INTEGER NOT NULL,
    "refrigerioMinuto" INTEGER NOT NULL DEFAULT 60,
    "toleranciaMinuto" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "turnos_trabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_turnos_trabajo" ("activo", "codigo", "creadoEn", "empresaId", "finMinuto", "id", "inicioMinuto", "nombre", "refrigerioMinuto", "toleranciaMinuto") SELECT "activo", "codigo", "creadoEn", "empresaId", "finMinuto", "id", "inicioMinuto", "nombre", "refrigerioMinuto", "toleranciaMinuto" FROM "turnos_trabajo";
DROP TABLE "turnos_trabajo";
ALTER TABLE "new_turnos_trabajo" RENAME TO "turnos_trabajo";
CREATE UNIQUE INDEX "turnos_trabajo_empresaId_codigo_key" ON "turnos_trabajo"("empresaId", "codigo");
CREATE TABLE "new_registros_asistencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "empleadoId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "entrada" DATETIME,
    "salida" DATETIME,
    "minutosTrabajados" INTEGER NOT NULL DEFAULT 0,
    "minutosTardanza" INTEGER NOT NULL DEFAULT 0,
    "minutosSobretiempo" INTEGER NOT NULL DEFAULT 0,
    "ausenciaJustificada" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "aprobadoEn" DATETIME,
    "aprobadoPorId" TEXT,
    "aprobadoPorNombre" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_asistencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "registros_asistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_registros_asistencia" ("aprobadoEn", "aprobadoPorId", "aprobadoPorNombre", "ausenciaJustificada", "creadoEn", "empleadoId", "empresaId", "entrada", "estado", "fecha", "id", "minutosSobretiempo", "minutosTardanza", "minutosTrabajados", "observacion", "salida", "usuarioId", "usuarioNombre") SELECT "aprobadoEn", "aprobadoPorId", "aprobadoPorNombre", "ausenciaJustificada", "creadoEn", "empleadoId", "empresaId", "entrada", "estado", "fecha", "id", "minutosSobretiempo", "minutosTardanza", "minutosTrabajados", "observacion", "salida", "usuarioId", "usuarioNombre" FROM "registros_asistencia";
DROP TABLE "registros_asistencia";
ALTER TABLE "new_registros_asistencia" RENAME TO "registros_asistencia";
CREATE INDEX "registros_asistencia_empresaId_fecha_estado_idx" ON "registros_asistencia"("empresaId", "fecha", "estado");
CREATE UNIQUE INDEX "registros_asistencia_empleadoId_fecha_key" ON "registros_asistencia"("empleadoId", "fecha");
CREATE TABLE "new_parametros_planilla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "rmv" DECIMAL NOT NULL,
    "uit" DECIMAL NOT NULL,
    "tasaEsSalud" DECIMAL NOT NULL DEFAULT 9,
    "tasaOnp" DECIMAL NOT NULL DEFAULT 13,
    "vigenteDesde" DATETIME NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parametros_planilla_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_parametros_planilla" ("creadoEn", "empresaId", "id", "rmv", "tasaEsSalud", "tasaOnp", "uit", "usuarioId", "usuarioNombre", "vigenteDesde") SELECT "creadoEn", "empresaId", "id", "rmv", "tasaEsSalud", "tasaOnp", "uit", "usuarioId", "usuarioNombre", "vigenteDesde" FROM "parametros_planilla";
DROP TABLE "parametros_planilla";
ALTER TABLE "new_parametros_planilla" RENAME TO "parametros_planilla";
CREATE TABLE "new_politicas_tiempo_trabajo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "vigenteDesde" DATETIME NOT NULL,
    "horasJornadaDiaria" DECIMAL NOT NULL DEFAULT 8,
    "primerasHorasRecargo" DECIMAL NOT NULL DEFAULT 2,
    "recargoPrimerTramo" DECIMAL NOT NULL DEFAULT 25,
    "recargoSegundoTramo" DECIMAL NOT NULL DEFAULT 35,
    "aplicarPagoSobretiempo" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "aprobadoEn" DATETIME,
    "aprobadoPorId" TEXT,
    "aprobadoPorNombre" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "politicas_tiempo_trabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_politicas_tiempo_trabajo" ("aplicarPagoSobretiempo", "aprobadoEn", "aprobadoPorId", "aprobadoPorNombre", "creadoEn", "empresaId", "estado", "horasJornadaDiaria", "id", "primerasHorasRecargo", "recargoPrimerTramo", "recargoSegundoTramo", "usuarioId", "usuarioNombre", "vigenteDesde") SELECT "aplicarPagoSobretiempo", "aprobadoEn", "aprobadoPorId", "aprobadoPorNombre", "creadoEn", "empresaId", "estado", "horasJornadaDiaria", "id", "primerasHorasRecargo", "recargoPrimerTramo", "recargoSegundoTramo", "usuarioId", "usuarioNombre", "vigenteDesde" FROM "politicas_tiempo_trabajo";
DROP TABLE "politicas_tiempo_trabajo";
ALTER TABLE "new_politicas_tiempo_trabajo" RENAME TO "politicas_tiempo_trabajo";
CREATE INDEX "politicas_tiempo_trabajo_empresaId_estado_vigenteDesde_idx" ON "politicas_tiempo_trabajo"("empresaId", "estado", "vigenteDesde");
CREATE UNIQUE INDEX "politicas_tiempo_trabajo_empresaId_vigenteDesde_key" ON "politicas_tiempo_trabajo"("empresaId", "vigenteDesde");
CREATE TABLE "new_planilla_periodos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'MENSUAL',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" DATETIME,
    CONSTRAINT "planilla_periodos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_planilla_periodos" ("anio", "cerradoEn", "creadoEn", "empresaId", "estado", "id", "mes", "tipo", "usuarioId", "usuarioNombre") SELECT "anio", "cerradoEn", "creadoEn", "empresaId", "estado", "id", "mes", "tipo", "usuarioId", "usuarioNombre" FROM "planilla_periodos";
DROP TABLE "planilla_periodos";
ALTER TABLE "new_planilla_periodos" RENAME TO "planilla_periodos";
CREATE UNIQUE INDEX "planilla_periodos_empresaId_anio_mes_tipo_key" ON "planilla_periodos"("empresaId", "anio", "mes", "tipo");
CREATE TABLE "new_adjuntos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adjuntos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_adjuntos" ("creadoEn", "empresaId", "entidadId", "entidadTipo", "id", "mimeType", "nombreArchivo", "nombreOriginal", "tamanioBytes", "usuarioId", "usuarioNombre") SELECT "creadoEn", "empresaId", "entidadId", "entidadTipo", "id", "mimeType", "nombreArchivo", "nombreOriginal", "tamanioBytes", "usuarioId", "usuarioNombre" FROM "adjuntos";
DROP TABLE "adjuntos";
ALTER TABLE "new_adjuntos" RENAME TO "adjuntos";
CREATE INDEX "adjuntos_entidadTipo_entidadId_idx" ON "adjuntos"("entidadTipo", "entidadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
