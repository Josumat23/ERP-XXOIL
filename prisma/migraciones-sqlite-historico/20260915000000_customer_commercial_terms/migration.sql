-- Condiciones comerciales del cliente.
--
-- El descuento propio REEMPLAZA al del canal cuando está declarado, no se
-- suma. Lo más específico manda: es la regla que cualquiera espera, y la única
-- que no obliga a inventar cómo se componen dos porcentajes (¿15% y 10% son
-- 25% o 23.5%?). NULL significa que rige el descuento del canal.
--
-- `requiereOrdenCompra` le da efecto a un campo que ya existía sin dueño:
-- `Pedido.ordenCompraCliente` se podía llenar o dejar en blanco y a nadie le
-- importaba. Un despacho sin la OC del cliente vuelve rechazado desde su
-- almacén, así que quien lo exige ahora lo exige de verdad.
--
-- Lo que NO se agrega en esta migración: la lista de precios. Asignar una
-- lista exige que exista el maestro de listas con sus ítems y que el cálculo
-- de precio lo lea; un campo que apunte a una tabla vacía sería un dato que
-- nadie usa. Va como módulo propio.

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
    "descuentoGeneralPct" DECIMAL,
    "pedidoMinimo" DECIMAL,
    "prioridadAtencion" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiereOrdenCompra" BOOLEAN NOT NULL DEFAULT false,
    "monedaDefecto" TEXT NOT NULL DEFAULT 'PEN',
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
INSERT INTO "new_clientes" ("almacenDespachoId", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "frecuenciaReparto", "id", "limiteCredito", "motivoEstado", "motivoNivelRiesgo", "nivelRiesgo", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "requiereAprobacionCredito", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "toleranciaVencimientoDias", "transportistaPreferidoId", "ubigeoId", "vendedorId", "zonaId") SELECT "almacenDespachoId", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "frecuenciaReparto", "id", "limiteCredito", "motivoEstado", "motivoNivelRiesgo", "nivelRiesgo", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "requiereAprobacionCredito", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "toleranciaVencimientoDias", "transportistaPreferidoId", "ubigeoId", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
