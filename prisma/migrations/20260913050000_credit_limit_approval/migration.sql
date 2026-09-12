-- Aprobacion del cambio de limite de credito.
--
-- Un aumento del limite es exposicion financiera nueva, y hasta ahora se
-- aplicaba con solo tener permiso de edicion. Con el control activo, el
-- limite NO cambia hasta que alguien lo aprueba.
--
-- montoAprobacionCredito nace en NULL: el control esta apagado y el limite se
-- edita directo, como venia funcionando. Ponerle un numero lo enciende; es
-- una decision de politica de credito y el sistema no elige una.

ALTER TABLE "configuracion_empresa" ADD COLUMN "montoAprobacionCredito" DECIMAL;

-- CreateTable
CREATE TABLE "solicitudes_cambio_credito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "limiteAnterior" DECIMAL NOT NULL,
    "limiteSolicitado" DECIMAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "solicitadoPorId" TEXT NOT NULL,
    "solicitadoPorNombre" TEXT NOT NULL,
    "solicitadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoPorId" TEXT,
    "resueltoPorNombre" TEXT,
    "resueltoEn" DATETIME,
    "motivoResolucion" TEXT,
    CONSTRAINT "solicitudes_cambio_credito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "solicitudes_cambio_credito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "solicitudes_cambio_credito_empresaId_estado_solicitadoEn_idx" ON "solicitudes_cambio_credito"("empresaId", "estado", "solicitadoEn");

