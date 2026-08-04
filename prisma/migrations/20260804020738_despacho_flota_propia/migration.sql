-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guias_remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" DATETIME NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "transportista" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "equipoId" TEXT,
    "estadoDespacho" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "fechaSalida" DATETIME,
    "fechaEntrega" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_guias_remision" ("clienteId", "creadoEn", "dniConductor", "empresaId", "facturaId", "fechaTraslado", "id", "motivoTraslado", "numero", "observaciones", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "usuarioId", "usuarioNombre") SELECT "clienteId", "creadoEn", "dniConductor", "empresaId", "facturaId", "fechaTraslado", "id", "motivoTraslado", "numero", "observaciones", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "usuarioId", "usuarioNombre" FROM "guias_remision";
DROP TABLE "guias_remision";
ALTER TABLE "new_guias_remision" RENAME TO "guias_remision";
CREATE UNIQUE INDEX "guias_remision_numero_key" ON "guias_remision"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
