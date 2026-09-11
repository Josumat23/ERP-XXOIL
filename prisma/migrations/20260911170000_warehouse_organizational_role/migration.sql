-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_almacenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipo" TEXT NOT NULL DEFAULT 'ALMACEN_DISTRIBUCION',
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
-- Relleno: hasta ahora un almacen hacia de planta por convencion, si tenia un
-- CalendarioProduccion asociado (ver Blueprint 03 §2). La migracion traslada esa
-- convencion al campo explicito; el resto queda como almacen de distribucion.
INSERT INTO "new_almacenes" ("activo", "ciudad", "codigo", "codigoPostal", "creadoEn", "departamento", "direccion", "direccion2", "distrito", "empresaId", "encargado", "id", "nombre", "pais", "provincia", "tipo") SELECT "activo", "ciudad", "codigo", "codigoPostal", "creadoEn", "departamento", "direccion", "direccion2", "distrito", "empresaId", "encargado", "id", "nombre", "pais", "provincia", CASE WHEN EXISTS (SELECT 1 FROM "calendarios_produccion" WHERE "calendarios_produccion"."almacenId" = "almacenes"."id") THEN 'PLANTA' ELSE 'ALMACEN_DISTRIBUCION' END FROM "almacenes";
DROP TABLE "almacenes";
ALTER TABLE "new_almacenes" RENAME TO "almacenes";
CREATE UNIQUE INDEX "almacenes_empresaId_codigo_key" ON "almacenes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
