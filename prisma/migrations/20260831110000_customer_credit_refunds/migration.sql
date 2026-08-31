CREATE TABLE "creditos_cliente" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "clienteId" TEXT NOT NULL,
  "notaCreditoId" TEXT NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'PEN',
  "tipoCambioOrigen" DECIMAL NOT NULL DEFAULT 1,
  "montoOriginal" DECIMAL NOT NULL,
  "saldo" DECIMAL NOT NULL,
  "montoFuncionalOriginal" DECIMAL NOT NULL DEFAULT 0,
  "saldoFuncional" DECIMAL NOT NULL DEFAULT 0,
  "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creditos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "creditos_cliente_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "notas_credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "aplicaciones_credito_cliente" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "creditoId" TEXT NOT NULL,
  "facturaId" TEXT NOT NULL,
  "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "monto" DECIMAL NOT NULL,
  "creditoFuncionalAplicado" DECIMAL NOT NULL,
  "cxcFuncionalAplicada" DECIMAL NOT NULL,
  "diferenciaCambio" DECIMAL NOT NULL DEFAULT 0,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  CONSTRAINT "aplicaciones_credito_cliente_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aplicaciones_credito_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "reembolsos_cliente" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "creditoId" TEXT NOT NULL,
  "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "monto" DECIMAL NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'PEN',
  "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
  "montoFuncional" DECIMAL NOT NULL,
  "creditoFuncionalAplicado" DECIMAL NOT NULL,
  "diferenciaCambio" DECIMAL NOT NULL DEFAULT 0,
  "medioPago" TEXT NOT NULL,
  "referencia" TEXT,
  "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
  "aprobadoPor" TEXT,
  "aprobadoEn" DATETIME,
  "motivoRechazo" TEXT,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  CONSTRAINT "reembolsos_cliente_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "creditos_cliente_notaCreditoId_key" ON "creditos_cliente"("notaCreditoId");
CREATE INDEX "creditos_cliente_clienteId_estado_idx" ON "creditos_cliente"("clienteId", "estado");
CREATE INDEX "aplicaciones_credito_cliente_creditoId_idx" ON "aplicaciones_credito_cliente"("creditoId");
CREATE INDEX "aplicaciones_credito_cliente_facturaId_idx" ON "aplicaciones_credito_cliente"("facturaId");
CREATE INDEX "reembolsos_cliente_creditoId_estadoAprobacion_idx" ON "reembolsos_cliente"("creditoId", "estadoAprobacion");
-- Configura el pasivo en el primer plan maestro de cada empresa existente.
-- Si una instalación no tiene plan maestro, la operación queda visible en
-- Controles contables para que el contador seleccione su cuenta manualmente.
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo")
SELECT lower(hex(randomblob(16))), p."id", '4699',
       'Otras cuentas por pagar — saldos a favor de clientes', 'PASIVO'
FROM "planes_cuentas" p
WHERE p."esMaestro" = 1
  AND p."id" = (
    SELECT p2."id"
    FROM "planes_cuentas" p2
    WHERE p2."empresaId" = p."empresaId" AND p2."esMaestro" = 1
    ORDER BY p2."creadoEn", p2."id"
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" c
    WHERE c."planCuentasId" = p."id" AND c."codigo" = '4699'
  );

INSERT INTO "controles_contables" ("id", "empresaId", "clave", "cuentaId")
SELECT lower(hex(randomblob(16))), p."empresaId", 'SALDOS_FAVOR_CLIENTES', c."id"
FROM "planes_cuentas" p
JOIN "cuentas_contables" c
  ON c."planCuentasId" = p."id" AND c."codigo" = '4699'
WHERE p."esMaestro" = 1
  AND p."id" = (
    SELECT p2."id"
    FROM "planes_cuentas" p2
    WHERE p2."empresaId" = p."empresaId" AND p2."esMaestro" = 1
    ORDER BY p2."creadoEn", p2."id"
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "controles_contables" cc
    WHERE cc."empresaId" = p."empresaId" AND cc."clave" = 'SALDOS_FAVOR_CLIENTES'
  );