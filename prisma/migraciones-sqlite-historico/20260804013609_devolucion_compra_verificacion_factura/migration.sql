-- CreateTable
CREATE TABLE "devoluciones_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "montoCredito" DECIMAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devoluciones_compra_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cuentas_por_pagar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT NOT NULL,
    "ordenCompraId" TEXT,
    "recepcionCompraId" TEXT,
    "numeroDocumento" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL DEFAULT '01',
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "total" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "montoOriginal" DECIMAL,
    "monedaOriginal" TEXT,
    "tipoCambio" DECIMAL,
    "discrepanciaPrecioPct" DECIMAL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "cuentas_por_pagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cuentas_por_pagar_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cuentas_por_pagar_recepcionCompraId_fkey" FOREIGN KEY ("recepcionCompraId") REFERENCES "recepciones_compra" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cuentas_por_pagar" ("empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "moneda", "monedaOriginal", "montoOriginal", "numeroDocumento", "ordenCompraId", "proveedorId", "saldo", "tipoCambio", "tipoComprobante", "total", "usuarioId", "usuarioNombre") SELECT "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "moneda", "monedaOriginal", "montoOriginal", "numeroDocumento", "ordenCompraId", "proveedorId", "saldo", "tipoCambio", "tipoComprobante", "total", "usuarioId", "usuarioNombre" FROM "cuentas_por_pagar";
DROP TABLE "cuentas_por_pagar";
ALTER TABLE "new_cuentas_por_pagar" RENAME TO "cuentas_por_pagar";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
