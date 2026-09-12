-- Slotting multi-nivel: pasillo -> rack -> nivel -> posicion.
--
-- ZonaAlmacen era plana. SaldoZona resolvio la CANTIDAD por zona; esto
-- resuelve la JERARQUIA de ubicaciones, que es lo que quedaba pendiente.
--
-- parentId es nulo y aditivo: todas las zonas existentes quedan como raices
-- y nada cambia de comportamiento. El codigo sigue siendo unico por almacen
-- sin importar el nivel, para que una etiqueta identifique una sola
-- ubicacion.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_zonas_almacen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "almacenId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT,
    "parentId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "zonas_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "zonas_almacen_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "zonas_almacen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_zonas_almacen" ("activo", "almacenId", "codigo", "id", "nombre") SELECT "activo", "almacenId", "codigo", "id", "nombre" FROM "zonas_almacen";
DROP TABLE "zonas_almacen";
ALTER TABLE "new_zonas_almacen" RENAME TO "zonas_almacen";
CREATE INDEX "zonas_almacen_almacenId_parentId_idx" ON "zonas_almacen"("almacenId", "parentId");
CREATE UNIQUE INDEX "zonas_almacen_almacenId_codigo_key" ON "zonas_almacen"("almacenId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

