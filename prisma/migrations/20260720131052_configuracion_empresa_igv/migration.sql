-- CreateTable
CREATE TABLE "configuracion_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "razonSocial" TEXT NOT NULL DEFAULT 'Mi Empresa S.A.C.',
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tasaIgv" DECIMAL NOT NULL DEFAULT 18,
    "actualizadoEn" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_facturas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "condicionPago" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME NOT NULL,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "tasaIgv" DECIMAL NOT NULL DEFAULT 0,
    "igv" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoAnulacion" TEXT,
    "anuladaEn" DATETIME,
    "anuladaPor" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "facturas_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "facturas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_facturas" ("anuladaEn", "anuladaPor", "clienteId", "condicionPago", "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "moneda", "motivoAnulacion", "numero", "pedidoId", "saldo", "total", "usuarioId", "usuarioNombre", "vendedorId") SELECT "anuladaEn", "anuladaPor", "clienteId", "condicionPago", "empresaId", "estado", "fechaEmision", "fechaVencimiento", "id", "moneda", "motivoAnulacion", "numero", "pedidoId", "saldo", "total", "usuarioId", "usuarioNombre", "vendedorId" FROM "facturas";
DROP TABLE "facturas";
ALTER TABLE "new_facturas" RENAME TO "facturas";
CREATE UNIQUE INDEX "facturas_numero_key" ON "facturas"("numero");
CREATE UNIQUE INDEX "facturas_pedidoId_key" ON "facturas"("pedidoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
