-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_niveles_aprobacion_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoDesdePen" DECIMAL NOT NULL,
    "rolAprobador" TEXT NOT NULL DEFAULT 'GERENCIA',
    "almacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "niveles_aprobacion_compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "niveles_aprobacion_compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_niveles_aprobacion_compra" ("activo", "creadoEn", "empresaId", "id", "montoDesdePen", "nombre", "orden", "rolAprobador") SELECT "activo", "creadoEn", "empresaId", "id", "montoDesdePen", "nombre", "orden", "rolAprobador" FROM "niveles_aprobacion_compra";
DROP TABLE "niveles_aprobacion_compra";
ALTER TABLE "new_niveles_aprobacion_compra" RENAME TO "niveles_aprobacion_compra";
CREATE INDEX "niveles_aprobacion_compra_empresaId_almacenId_activo_idx" ON "niveles_aprobacion_compra"("empresaId", "almacenId", "activo");
CREATE UNIQUE INDEX "niveles_aprobacion_compra_empresaId_orden_key" ON "niveles_aprobacion_compra"("empresaId", "orden");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

