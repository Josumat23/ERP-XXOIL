-- AlterTable
ALTER TABLE "insumos" ADD COLUMN "codigoProveedor" TEXT;
ALTER TABLE "insumos" ADD COLUMN "notas" TEXT;
ALTER TABLE "insumos" ADD COLUMN "ubicacion" TEXT;

-- AlterTable
ALTER TABLE "presentaciones" ADD COLUMN "codigoBarras" TEXT;
ALTER TABLE "presentaciones" ADD COLUMN "pesoBrutoKg" DECIMAL;
ALTER TABLE "presentaciones" ADD COLUMN "ubicacion" TEXT;
ALTER TABLE "presentaciones" ADD COLUMN "unidadesPorCaja" INTEGER;

-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN "email" TEXT;
ALTER TABLE "vendedores" ADD COLUMN "telefono" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "zonaId" TEXT,
    "vendedorId" TEXT,
    "limiteCredito" DECIMAL NOT NULL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("activo", "creadoEn", "direccion", "email", "empresaId", "id", "pais", "razonSocial", "ruc", "telefono", "zonaId") SELECT "activo", "creadoEn", "direccion", "email", "empresaId", "id", "pais", "razonSocial", "ruc", "telefono", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE TABLE "new_productos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "categoriaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedidaBase" TEXT NOT NULL DEFAULT 'kg',
    "marca" TEXT,
    "gradoNlgi" TEXT,
    "viscosidad" TEXT,
    "notasTecnicas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_productos" ("activo", "actualizadoEn", "categoriaId", "codigo", "creadoEn", "descripcion", "empresaId", "id", "nombre") SELECT "activo", "actualizadoEn", "categoriaId", "codigo", "creadoEn", "descripcion", "empresaId", "id", "nombre" FROM "productos";
DROP TABLE "productos";
ALTER TABLE "new_productos" RENAME TO "productos";
CREATE UNIQUE INDEX "productos_empresaId_codigo_key" ON "productos"("empresaId", "codigo");
CREATE TABLE "new_proveedores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "cuentaBancaria" TEXT,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_proveedores" ("activo", "creadoEn", "direccion", "email", "empresaId", "id", "pais", "razonSocial", "ruc", "telefono") SELECT "activo", "creadoEn", "direccion", "email", "empresaId", "id", "pais", "razonSocial", "ruc", "telefono" FROM "proveedores";
DROP TABLE "proveedores";
ALTER TABLE "new_proveedores" RENAME TO "proveedores";
CREATE UNIQUE INDEX "proveedores_empresaId_ruc_key" ON "proveedores"("empresaId", "ruc");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
