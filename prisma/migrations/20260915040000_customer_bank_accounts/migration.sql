-- Cuentas bancarias del cliente.
--
-- Dato restringido: lo ve y lo edita quien tiene permiso de FINANZAS, no
-- Ventas. Un número de cuenta cambiado por alguien que no debía tocarlo es una
-- transferencia que se va a otro lado.
--
-- El titular puede no ser la razón social: muchas EIRL cobran en la cuenta
-- personal de su titular, y anotarlo evita que el banco rechace el abono.
--
-- `esPrincipal` es `true` o NULL, nunca `false`: los NULL no chocan entre sí en
-- un índice único, así que conviven varias cuentas secundarias y una sola
-- principal. Es el mismo mecanismo que en direcciones y contactos.

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "medioPagoPreferido" TEXT;

-- CreateTable
CREATE TABLE "cuentas_bancarias_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "tipoCuenta" TEXT NOT NULL DEFAULT 'CORRIENTE',
    "numeroCuenta" TEXT NOT NULL,
    "cci" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "titular" TEXT,
    "esPrincipal" BOOLEAN,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cuentas_bancarias_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cuentas_bancarias_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cuentas_bancarias_cliente_clienteId_activa_idx" ON "cuentas_bancarias_cliente"("clienteId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_bancarias_cliente_clienteId_esPrincipal_key" ON "cuentas_bancarias_cliente"("clienteId", "esPrincipal");
