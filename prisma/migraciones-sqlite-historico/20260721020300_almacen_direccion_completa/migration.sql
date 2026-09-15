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
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_almacenes" ("activo", "codigo", "creadoEn", "direccion", "empresaId", "id", "nombre") SELECT "activo", "codigo", "creadoEn", "direccion", "empresaId", "id", "nombre" FROM "almacenes";
DROP TABLE "almacenes";
ALTER TABLE "new_almacenes" RENAME TO "almacenes";
CREATE UNIQUE INDEX "almacenes_empresaId_codigo_key" ON "almacenes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
