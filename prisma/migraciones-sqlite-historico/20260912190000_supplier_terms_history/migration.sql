-- Historial de condiciones comerciales pactadas con un proveedor, con
-- vigencias. Responde "que plazo regia cuando se recibio esta factura" y
-- "por que cambio", que el campo mutable del maestro no puede contestar.
--
-- Tabla nueva y aditiva. Proveedor.condicionPagoDias sigue siendo el valor
-- vigente que lee el resto del sistema; el historial guarda desde cuando rige
-- cada version y por que se pacto.

CREATE TABLE "condiciones_comerciales_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proveedorId" TEXT NOT NULL,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "vigenteDesde" DATETIME NOT NULL,
    "vigenteHasta" DATETIME,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "condiciones_comerciales_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "condiciones_comerciales_proveedor_proveedorId_vigenteDesde_idx" ON "condiciones_comerciales_proveedor"("proveedorId", "vigenteDesde");

