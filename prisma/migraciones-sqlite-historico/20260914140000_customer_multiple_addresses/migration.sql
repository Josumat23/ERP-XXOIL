-- Direcciones múltiples por cliente.
--
-- Hasta ahora había UNA sola dirección en el maestro, y la de entrega se
-- retipeaba a mano en cada pedido (`pedidos.direccionEntrega`, texto libre).
-- Un cliente minero con tres unidades, o un distribuidor con dos almacenes,
-- no se podía modelar: la dirección real del despacho dependía de que el
-- vendedor la escribiera bien cada vez.
--
-- `principalDe` vale lo mismo que `tipo` cuando la dirección es la principal
-- de su tipo, y NULL cuando no lo es. Como en SQLite y en PostgreSQL los NULL
-- no chocan entre sí en un índice único, `UNIQUE(clienteId, principalDe)`
-- convierte «una sola principal por tipo» en una regla de la base.

-- CreateTable
CREATE TABLE "direcciones_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "principalDe" TEXT,
    "etiqueta" TEXT,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "ubigeoId" TEXT,
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "latitud" DECIMAL,
    "longitud" DECIMAL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "direcciones_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "direcciones_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "direcciones_cliente_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
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
    "fulfillmentVersion" INTEGER NOT NULL DEFAULT 0,
    "requiereEntrega" BOOLEAN NOT NULL DEFAULT false,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "condicionPago" TEXT NOT NULL DEFAULT 'CONTADO',
    "direccionEntrega" TEXT,
    "direccionEntregaId" TEXT,
    "ordenCompraCliente" TEXT,
    "referenciaCliente" TEXT,
    "subtotalBruto" DECIMAL NOT NULL DEFAULT 0,
    "descuentoTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "tasaIgv" DECIMAL NOT NULL DEFAULT 0,
    "igv" DECIMAL NOT NULL DEFAULT 0,
    "totalConIgv" DECIMAL NOT NULL DEFAULT 0,
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
    CONSTRAINT "pedidos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_direccionEntregaId_fkey" FOREIGN KEY ("direccionEntregaId") REFERENCES "direcciones_cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pedidos" ("almacenId", "clienteId", "condicionPago", "condicionPagoCredito", "creditoResueltoEn", "creditoResueltoPor", "creditoSolicitadoEn", "descuentoTotal", "deudaCreditoEvaluada", "direccionEntrega", "empresaId", "estado", "estadoAprobacionCredito", "fecha", "fechaEntregaSolicitada", "fulfillmentVersion", "id", "igv", "limiteCreditoEvaluado", "moneda", "montoCreditoEvaluado", "motivoRechazoCredito", "notas", "numero", "ordenCompraCliente", "referenciaCliente", "requiereEntrega", "subtotalBruto", "tasaIgv", "tipoCambio", "total", "totalConIgv", "usuarioId", "usuarioNombre", "vendedorId") SELECT "almacenId", "clienteId", "condicionPago", "condicionPagoCredito", "creditoResueltoEn", "creditoResueltoPor", "creditoSolicitadoEn", "descuentoTotal", "deudaCreditoEvaluada", "direccionEntrega", "empresaId", "estado", "estadoAprobacionCredito", "fecha", "fechaEntregaSolicitada", "fulfillmentVersion", "id", "igv", "limiteCreditoEvaluado", "moneda", "montoCreditoEvaluado", "motivoRechazoCredito", "notas", "numero", "ordenCompraCliente", "referenciaCliente", "requiereEntrega", "subtotalBruto", "tasaIgv", "tipoCambio", "total", "totalConIgv", "usuarioId", "usuarioNombre", "vendedorId" FROM "pedidos";
DROP TABLE "pedidos";
ALTER TABLE "new_pedidos" RENAME TO "pedidos";
CREATE UNIQUE INDEX "pedidos_empresaId_numero_key" ON "pedidos"("empresaId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "direcciones_cliente_clienteId_tipo_idx" ON "direcciones_cliente"("clienteId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "direcciones_cliente_clienteId_principalDe_key" ON "direcciones_cliente"("clienteId", "principalDe");


-- La dirección que cada cliente ya tenía pasa a ser su domicilio FISCAL
-- principal. Nadie pierde el dato que cargó, y el maestro queda con al menos
-- una dirección desde el primer día.
INSERT INTO "direcciones_cliente" (
  "id", "empresaId", "clienteId", "tipo", "principalDe", "etiqueta",
  "direccion", "ubigeoId", "departamento", "provincia", "distrito", "pais",
  "contactoNombre", "contactoTelefono", "activa", "creadoEn"
)
SELECT
  'dir-fis-' || "id", "empresaId", "id", 'FISCAL', 'FISCAL', 'Domicilio fiscal',
  "direccion", "ubigeoId", "departamento", "provincia", "distrito", "pais",
  "contactoNombre", "contactoTelefono", 1, CURRENT_TIMESTAMP
FROM "clientes"
WHERE "direccion" IS NOT NULL AND TRIM("direccion") <> '';
