-- El límite de crédito pasa a tener tres estados distintos.
--
-- Hasta ahora `limiteCredito` era NOT NULL con 0 por defecto, y ese 0
-- significaba «sin límite»: el valor que parecía el más seguro era el más
-- permisivo del sistema. Peor, significaba tres cosas a la vez según quién lo
-- leyera — «sin tope» al evaluar, «requiere aprobación» al dar de alta, y
-- «contado, no evaluar» al tomar un pedido.
--
--   NULL = sin tope, heredado y sin evaluar nunca
--   0    = SIN CRÉDITO: solo contado, hasta que Créditos lo evalúe
--   > 0  = el techo real
--
-- Los clientes que hoy están en 0 pasan a NULL para conservar exactamente su
-- operación: nadie se queda sin poder facturar por este cambio. El 0 como
-- «sin crédito» rige para las altas nuevas, que es donde importa.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "canal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "ubigeoId" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "zonaId" TEXT,
    "vendedorId" TEXT,
    "limiteCredito" DECIMAL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "bloqueadoCobranza" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoCobranzaEn" DATETIME,
    "bloqueadoCobranzaPor" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clientes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("activo", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "ubigeoId", "vendedorId", "zonaId") SELECT "activo", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "ubigeoId", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_solicitudes_cambio_credito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "limiteAnterior" DECIMAL,
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
INSERT INTO "new_solicitudes_cambio_credito" ("clienteId", "empresaId", "estado", "id", "limiteAnterior", "limiteSolicitado", "motivo", "motivoResolucion", "resueltoEn", "resueltoPorId", "resueltoPorNombre", "solicitadoEn", "solicitadoPorId", "solicitadoPorNombre") SELECT "clienteId", "empresaId", "estado", "id", "limiteAnterior", "limiteSolicitado", "motivo", "motivoResolucion", "resueltoEn", "resueltoPorId", "resueltoPorNombre", "solicitadoEn", "solicitadoPorId", "solicitadoPorNombre" FROM "solicitudes_cambio_credito";
DROP TABLE "solicitudes_cambio_credito";
ALTER TABLE "new_solicitudes_cambio_credito" RENAME TO "solicitudes_cambio_credito";
CREATE INDEX "solicitudes_cambio_credito_empresaId_estado_solicitadoEn_idx" ON "solicitudes_cambio_credito"("empresaId", "estado", "solicitadoEn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Los que ya existían conservan su operación: 0 significaba «sin tope».
UPDATE "clientes" SET "limiteCredito" = NULL WHERE "limiteCredito" = 0;
