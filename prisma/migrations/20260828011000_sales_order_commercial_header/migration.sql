-- RedefineTable
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pedidos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntregaSolicitada" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "condicionPago" TEXT NOT NULL DEFAULT 'CONTADO',
    "direccionEntrega" TEXT,
    "ordenCompraCliente" TEXT,
    "referenciaCliente" TEXT,
    "total" DECIMAL NOT NULL,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacionCredito" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "condicionPagoCredito" TEXT,
    "deudaCreditoEvaluada" DECIMAL,
    "montoCreditoEvaluado" DECIMAL,
    "limiteCreditoEvaluado" DECIMAL,
    "creditoSolicitadoEn" DATETIME,
    "creditoResueltoEn" DATETIME,
    "creditoResueltoPor" TEXT,
    "motivoRechazoCredito" TEXT,
    CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pedidos" (
    "id", "empresaId", "numero", "clienteId", "vendedorId", "fecha", "estado", "total", "notas",
    "usuarioId", "usuarioNombre", "estadoAprobacionCredito", "condicionPagoCredito", "deudaCreditoEvaluada",
    "montoCreditoEvaluado", "limiteCreditoEvaluado", "creditoSolicitadoEn", "creditoResueltoEn",
    "creditoResueltoPor", "motivoRechazoCredito"
)
SELECT
    "id", "empresaId", "numero", "clienteId", "vendedorId", "fecha", "estado", "total", "notas",
    "usuarioId", "usuarioNombre", "estadoAprobacionCredito", "condicionPagoCredito", "deudaCreditoEvaluada",
    "montoCreditoEvaluado", "limiteCreditoEvaluado", "creditoSolicitadoEn", "creditoResueltoEn",
    "creditoResueltoPor", "motivoRechazoCredito"
FROM "pedidos";
DROP TABLE "pedidos";
ALTER TABLE "new_pedidos" RENAME TO "pedidos";
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;