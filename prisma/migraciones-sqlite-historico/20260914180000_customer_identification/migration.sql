-- Identificación del cliente: tipo de persona y estado de tres valores.
--
-- `activo` era un booleano y el negocio pidió ACTIVO / BLOQUEADO / INACTIVO.
-- BLOQUEADO es una decisión de una persona sobre el maestro —falta
-- documentación, orden de legal— y es DISTINTO de `bloqueadoCobranza`, que es
-- un control financiero automático. Se dejan ortogonales a propósito: para
-- vender hay que pasar los dos, y fundirlos haría que levantar una deuda
-- desbloquee un cliente que legal había frenado.
--
-- La traducción va dentro del INSERT de la redefinición: la tabla vieja se
-- borra en el mismo paso, así que después ya no habría de dónde leer `activo`.

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
    "tipoPersona" TEXT,
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
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "motivoEstado" TEXT,
    "estadoDesde" DATETIME,
    "estadoPorId" TEXT,
    "estadoPorNombre" TEXT,
    "bloqueadoCobranza" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoCobranzaEn" DATETIME,
    "bloqueadoCobranzaPor" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clientes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "ubigeoId", "vendedorId", "zonaId", "estado", "tipoPersona") SELECT "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "ubigeoId", "vendedorId", "zonaId",
  -- El booleano se traduce al estado de tres valores. BLOQUEADO no sale de
  -- aquí: es una decisión de una persona, y nadie la ha tomado todavía.
  CASE WHEN "activo" = 1 THEN 'ACTIVO' ELSE 'INACTIVO' END,
  -- El prefijo del RUC peruano dice si es persona natural o jurídica: 10 y
  -- 20 son inequívocos. Cualquier otro caso queda NULL antes que inventarlo.
  CASE
    WHEN "tipoDocumentoFiscal" = 'RUC' AND "ruc" LIKE '10%' AND LENGTH("ruc") = 11 THEN 'NATURAL'
    WHEN "tipoDocumentoFiscal" = 'RUC' AND "ruc" LIKE '20%' AND LENGTH("ruc") = 11 THEN 'JURIDICA'
    ELSE NULL
  END
FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

