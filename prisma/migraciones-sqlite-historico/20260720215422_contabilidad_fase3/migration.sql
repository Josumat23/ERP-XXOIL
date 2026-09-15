-- CreateTable
CREATE TABLE "planes_cuentas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esMaestro" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "cuentas_contables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planCuentasId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cuentas_contables_planCuentasId_fkey" FOREIGN KEY ("planCuentasId") REFERENCES "planes_cuentas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "libros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "asientos_contables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "libroId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "glosa" TEXT NOT NULL,
    "referencia" TEXT,
    "reversadoPor" TEXT,
    "reversaA" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asientos_contables_libroId_fkey" FOREIGN KEY ("libroId") REFERENCES "libros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asiento_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asientoId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "glosa" TEXT,
    "debe" DECIMAL NOT NULL DEFAULT 0,
    "haber" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "asiento_detalles_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "asientos_contables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asiento_detalles_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "controles_contables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clave" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    CONSTRAINT "controles_contables_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "planes_cuentas_empresaId_codigo_key" ON "planes_cuentas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_contables_planCuentasId_codigo_key" ON "cuentas_contables"("planCuentasId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "libros_empresaId_codigo_key" ON "libros"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "asientos_contables_numero_key" ON "asientos_contables"("numero");

-- CreateIndex
CREATE INDEX "asientos_contables_anio_mes_idx" ON "asientos_contables"("anio", "mes");

-- CreateIndex
CREATE INDEX "asiento_detalles_cuentaId_idx" ON "asiento_detalles"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "controles_contables_empresaId_clave_key" ON "controles_contables"("empresaId", "clave");
