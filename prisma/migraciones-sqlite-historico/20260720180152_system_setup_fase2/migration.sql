/*
  Warnings:

  - You are about to drop the column `ubicacion` on the `insumos` table. All the data in the column will be lost.
  - You are about to drop the column `ubicacion` on the `presentaciones` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "series_documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipoDocumento" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "correlativoActual" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "almacenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "zonas_almacen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "almacenId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "zonas_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clases_unidad_medida" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "unidades_medida" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claseId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "unidades_medida_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "clases_unidad_medida" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupos_seguridad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPredefinido" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "permisos_grupo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grupoId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "puedeVer" BOOLEAN NOT NULL DEFAULT true,
    "puedeCrear" BOOLEAN NOT NULL DEFAULT false,
    "puedeEditar" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "permisos_grupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_seguridad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "periodos_fiscales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "cerradoEn" DATETIME,
    "cerradoPor" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_insumos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "codigoProveedor" TEXT,
    "zonaAlmacenId" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "insumos_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_insumos" ("activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "id", "moneda", "nombre", "notas", "proveedorId", "stock", "stockMinimo", "tipo", "unidadMedida") SELECT "activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "id", "moneda", "nombre", "notas", "proveedorId", "stock", "stockMinimo", "tipo", "unidadMedida" FROM "insumos";
DROP TABLE "insumos";
ALTER TABLE "new_insumos" RENAME TO "insumos";
CREATE UNIQUE INDEX "insumos_empresaId_codigo_key" ON "insumos"("empresaId", "codigo");
CREATE TABLE "new_presentaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenidoKg" DECIMAL NOT NULL,
    "precio" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL NOT NULL DEFAULT 0,
    "codigoBarras" TEXT,
    "pesoBrutoKg" DECIMAL,
    "unidadesPorCaja" INTEGER,
    "zonaAlmacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "presentaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "presentaciones_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_presentaciones" ("activo", "actualizadoEn", "codigoBarras", "contenidoKg", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "unidadesPorCaja") SELECT "activo", "actualizadoEn", "codigoBarras", "contenidoKg", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "unidadesPorCaja" FROM "presentaciones";
DROP TABLE "presentaciones";
ALTER TABLE "new_presentaciones" RENAME TO "presentaciones";
CREATE UNIQUE INDEX "presentaciones_empresaId_sku_key" ON "presentaciones"("empresaId", "sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "series_documento_empresaId_tipoDocumento_serie_key" ON "series_documento"("empresaId", "tipoDocumento", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "almacenes_empresaId_codigo_key" ON "almacenes"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_almacen_almacenId_codigo_key" ON "zonas_almacen"("almacenId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "clases_unidad_medida_empresaId_codigo_key" ON "clases_unidad_medida"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_claseId_codigo_key" ON "unidades_medida"("claseId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_seguridad_empresaId_codigo_key" ON "grupos_seguridad"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_grupo_grupoId_modulo_key" ON "permisos_grupo"("grupoId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_fiscales_empresaId_anio_mes_key" ON "periodos_fiscales"("empresaId", "anio", "mes");
