-- Perfil de crédito del cliente.
--
-- Tres campos, y ninguno duplica lo que ya existe:
--
--   nivelRiesgo / motivoNivelRiesgo
--     Clasificación puesta por una persona. NO se calcula con un puntaje
--     inventado; lo que sí se calcula desde los movimientos es el
--     comportamiento de pago, y se muestra al lado para que quien clasifique
--     mire hechos.
--
--   toleranciaVencimientoDias
--     Días de gracia antes de contar una factura como vencida para ESTE
--     cliente. Corre la política de escalamiento de la compañía, no la
--     reemplaza: NULL significa que rige la política tal cual.
--
--   requiereAprobacionCredito
--     «Sujeto a aprobación»: toda venta a crédito pasa por la bandeja, esté o
--     no dentro del límite. Es distinto de no tener cupo — es no tener
--     autonomía — y por eso es bandera propia y no un límite en cero.
--
-- Lo que NO se agrega: un `diasCredito`. `CondicionPago` ya expresa los días
-- y está embebida en pedidos, facturas y aprobaciones de crédito; un campo
-- paralelo serían dos fuentes de verdad para el mismo dato.
--
-- Y tampoco un `estadoCredito`: se deriva de `bloqueadoCobranza` y de la
-- bandera de aprobación. Una tercera columna de bloqueo que hay que mantener
-- en sintonía con las otras dos es justamente cómo se contradicen entre sí.

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
    "almacenDespachoId" TEXT,
    "transportistaPreferidoId" TEXT,
    "frecuenciaReparto" TEXT,
    "limiteCredito" DECIMAL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "nivelRiesgo" TEXT,
    "motivoNivelRiesgo" TEXT,
    "toleranciaVencimientoDias" INTEGER,
    "requiereAprobacionCredito" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_almacenDespachoId_fkey" FOREIGN KEY ("almacenDespachoId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_transportistaPreferidoId_fkey" FOREIGN KEY ("transportistaPreferidoId") REFERENCES "transportistas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("almacenDespachoId", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "frecuenciaReparto", "id", "limiteCredito", "motivoEstado", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "transportistaPreferidoId", "ubigeoId", "vendedorId", "zonaId") SELECT "almacenDespachoId", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "frecuenciaReparto", "id", "limiteCredito", "motivoEstado", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "transportistaPreferidoId", "ubigeoId", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
