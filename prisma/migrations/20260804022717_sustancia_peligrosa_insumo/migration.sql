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
    "esRetornable" BOOLEAN NOT NULL DEFAULT false,
    "montoDeposito" DECIMAL,
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "codigoProveedor" TEXT,
    "zonaAlmacenId" TEXT,
    "notas" TEXT,
    "requiereInspeccion" BOOLEAN NOT NULL DEFAULT false,
    "esPeligroso" BOOLEAN NOT NULL DEFAULT false,
    "claseGhs" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "insumos_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_insumos" ("activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "esRetornable", "id", "moneda", "montoDeposito", "nombre", "notas", "proveedorId", "requiereInspeccion", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "esRetornable", "id", "moneda", "montoDeposito", "nombre", "notas", "proveedorId", "requiereInspeccion", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId" FROM "insumos";
DROP TABLE "insumos";
ALTER TABLE "new_insumos" RENAME TO "insumos";
CREATE UNIQUE INDEX "insumos_empresaId_codigo_key" ON "insumos"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
