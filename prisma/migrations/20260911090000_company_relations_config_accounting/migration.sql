-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_almacenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "encargado" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "almacenes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_almacenes" ("activo", "ciudad", "codigo", "codigoPostal", "creadoEn", "departamento", "direccion", "direccion2", "distrito", "empresaId", "encargado", "id", "nombre", "pais", "provincia") SELECT "activo", "ciudad", "codigo", "codigoPostal", "creadoEn", "departamento", "direccion", "direccion2", "distrito", "empresaId", "encargado", "id", "nombre", "pais", "provincia" FROM "almacenes";
DROP TABLE "almacenes";
ALTER TABLE "new_almacenes" RENAME TO "almacenes";
CREATE UNIQUE INDEX "almacenes_empresaId_codigo_key" ON "almacenes"("empresaId", "codigo");
CREATE TABLE "new_clases_unidad_medida" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clases_unidad_medida_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_clases_unidad_medida" ("activo", "codigo", "creadoEn", "empresaId", "id", "nombre") SELECT "activo", "codigo", "creadoEn", "empresaId", "id", "nombre" FROM "clases_unidad_medida";
DROP TABLE "clases_unidad_medida";
ALTER TABLE "new_clases_unidad_medida" RENAME TO "clases_unidad_medida";
CREATE UNIQUE INDEX "clases_unidad_medida_empresaId_codigo_key" ON "clases_unidad_medida"("empresaId", "codigo");
CREATE TABLE "new_grupos_seguridad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPredefinido" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grupos_seguridad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_grupos_seguridad" ("activo", "codigo", "creadoEn", "empresaId", "esPredefinido", "id", "nombre") SELECT "activo", "codigo", "creadoEn", "empresaId", "esPredefinido", "id", "nombre" FROM "grupos_seguridad";
DROP TABLE "grupos_seguridad";
ALTER TABLE "new_grupos_seguridad" RENAME TO "grupos_seguridad";
CREATE UNIQUE INDEX "grupos_seguridad_empresaId_codigo_key" ON "grupos_seguridad"("empresaId", "codigo");
CREATE TABLE "new_periodos_fiscales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "cerradoEn" DATETIME,
    "cerradoPor" TEXT,
    CONSTRAINT "periodos_fiscales_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_periodos_fiscales" ("anio", "cerradoEn", "cerradoPor", "empresaId", "estado", "id", "mes") SELECT "anio", "cerradoEn", "cerradoPor", "empresaId", "estado", "id", "mes" FROM "periodos_fiscales";
DROP TABLE "periodos_fiscales";
ALTER TABLE "new_periodos_fiscales" RENAME TO "periodos_fiscales";
CREATE UNIQUE INDEX "periodos_fiscales_empresaId_anio_mes_key" ON "periodos_fiscales"("empresaId", "anio", "mes");
CREATE TABLE "new_planes_cuentas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esMaestro" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planes_cuentas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_planes_cuentas" ("codigo", "creadoEn", "empresaId", "esMaestro", "id", "nombre") SELECT "codigo", "creadoEn", "empresaId", "esMaestro", "id", "nombre" FROM "planes_cuentas";
DROP TABLE "planes_cuentas";
ALTER TABLE "new_planes_cuentas" RENAME TO "planes_cuentas";
CREATE UNIQUE INDEX "planes_cuentas_empresaId_codigo_key" ON "planes_cuentas"("empresaId", "codigo");
CREATE TABLE "new_libros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "libros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_libros" ("codigo", "creadoEn", "empresaId", "id", "moneda", "nombre") SELECT "codigo", "creadoEn", "empresaId", "id", "moneda", "nombre" FROM "libros";
DROP TABLE "libros";
ALTER TABLE "new_libros" RENAME TO "libros";
CREATE UNIQUE INDEX "libros_empresaId_codigo_key" ON "libros"("empresaId", "codigo");
CREATE TABLE "new_asientos_contables" (
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
    CONSTRAINT "asientos_contables_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asientos_contables_libroId_fkey" FOREIGN KEY ("libroId") REFERENCES "libros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_asientos_contables" ("anio", "creadoEn", "empresaId", "fecha", "glosa", "id", "libroId", "mes", "numero", "origen", "referencia", "reversaA", "reversadoPor", "usuarioId", "usuarioNombre") SELECT "anio", "creadoEn", "empresaId", "fecha", "glosa", "id", "libroId", "mes", "numero", "origen", "referencia", "reversaA", "reversadoPor", "usuarioId", "usuarioNombre" FROM "asientos_contables";
DROP TABLE "asientos_contables";
ALTER TABLE "new_asientos_contables" RENAME TO "asientos_contables";
CREATE UNIQUE INDEX "asientos_contables_numero_key" ON "asientos_contables"("numero");
CREATE INDEX "asientos_contables_anio_mes_idx" ON "asientos_contables"("anio", "mes");
CREATE TABLE "new_controles_contables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clave" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    CONSTRAINT "controles_contables_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "controles_contables_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_controles_contables" ("clave", "cuentaId", "empresaId", "id") SELECT "clave", "cuentaId", "empresaId", "id" FROM "controles_contables";
DROP TABLE "controles_contables";
ALTER TABLE "new_controles_contables" RENAME TO "controles_contables";
CREATE UNIQUE INDEX "controles_contables_empresaId_clave_key" ON "controles_contables"("empresaId", "clave");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
