-- Boleta de venta.
--
-- El tipo de comprobante se DERIVA del documento del comprador al emitir
-- (RUC peruano -> factura; DNI o sin documento -> boleta), no del canal
-- comercial: un cliente minorista que es empresa con RUC recibe factura
-- igual. Es la distincion del Catalogo 01 de SUNAT.
--
-- Factura.tipoComprobante nace en FACTURA para todas las filas existentes, y
-- eso es correcto: hasta ahora el sistema solo emitia factura.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_facturas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL DEFAULT 'FACTURA',
    "pedidoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "monedaFuncional" TEXT NOT NULL DEFAULT 'PEN',
    "condicionPago" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME NOT NULL,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "tasaIgv" DECIMAL NOT NULL DEFAULT 0,
    "igv" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "subtotalFuncional" DECIMAL NOT NULL DEFAULT 0,
    "igvFuncional" DECIMAL NOT NULL DEFAULT 0,
    "totalFuncional" DECIMAL NOT NULL DEFAULT 0,
    "saldoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoAnulacion" TEXT,
    "anuladaEn" DATETIME,
    "anuladaPor" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "facturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_facturas" ("anuladaEn", "anuladaPor", "clienteId", "condicionPago", "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "igv", "igvFuncional", "moneda", "monedaFuncional", "motivoAnulacion", "numero", "pedidoId", "saldo", "saldoFuncional", "subtotal", "subtotalFuncional", "tasaIgv", "tipoCambio", "total", "totalFuncional", "usuarioId", "usuarioNombre", "vendedorId") SELECT "anuladaEn", "anuladaPor", "clienteId", "condicionPago", "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "igv", "igvFuncional", "moneda", "monedaFuncional", "motivoAnulacion", "numero", "pedidoId", "saldo", "saldoFuncional", "subtotal", "subtotalFuncional", "tasaIgv", "tipoCambio", "total", "totalFuncional", "usuarioId", "usuarioNombre", "vendedorId" FROM "facturas";
DROP TABLE "facturas";
ALTER TABLE "new_facturas" RENAME TO "facturas";
CREATE INDEX "facturas_pedidoId_idx" ON "facturas"("pedidoId");
CREATE UNIQUE INDEX "facturas_empresaId_numero_key" ON "facturas"("empresaId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

