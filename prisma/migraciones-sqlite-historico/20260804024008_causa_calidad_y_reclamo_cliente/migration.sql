-- CreateTable
CREATE TABLE "causas_calidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "reclamos_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT,
    "causaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "accionCorrectiva" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "reclamos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reclamos_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reclamos_cliente_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "causas_calidad" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_controles_calidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteGranelId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "observaciones" TEXT,
    "causaId" TEXT,
    "causaRaiz" TEXT,
    "accionCorrectiva" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "controles_calidad_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "controles_calidad_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "causas_calidad" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_controles_calidad" ("accionCorrectiva", "causaRaiz", "fecha", "id", "loteGranelId", "observaciones", "resultado", "usuarioId", "usuarioNombre") SELECT "accionCorrectiva", "causaRaiz", "fecha", "id", "loteGranelId", "observaciones", "resultado", "usuarioId", "usuarioNombre" FROM "controles_calidad";
DROP TABLE "controles_calidad";
ALTER TABLE "new_controles_calidad" RENAME TO "controles_calidad";
CREATE UNIQUE INDEX "controles_calidad_loteGranelId_key" ON "controles_calidad"("loteGranelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "causas_calidad_empresaId_nombre_key" ON "causas_calidad"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "reclamos_cliente_numero_key" ON "reclamos_cliente"("numero");
