CREATE TABLE "niveles_aprobacion_compra" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "orden" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "montoDesdePen" DECIMAL NOT NULL,
  "rolAprobador" TEXT NOT NULL DEFAULT 'GERENCIA',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "niveles_aprobacion_compra_empresaId_orden_key" ON "niveles_aprobacion_compra"("empresaId", "orden");

CREATE TABLE "pasos_aprobacion_compra" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ordenCompraId" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "montoDesdePen" DECIMAL NOT NULL,
  "rolAprobador" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "resueltoPorId" TEXT,
  "resueltoPorNombre" TEXT,
  "resueltoEn" DATETIME,
  "motivo" TEXT,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pasos_aprobacion_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pasos_aprobacion_compra_ordenCompraId_orden_key" ON "pasos_aprobacion_compra"("ordenCompraId", "orden");
