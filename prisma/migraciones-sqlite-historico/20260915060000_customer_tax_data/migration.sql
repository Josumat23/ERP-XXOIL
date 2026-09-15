-- Datos fiscales declarados del cliente.
--
-- TODO lo que agrega esta migración se carga a mano desde la ficha RUC. NO hay
-- servicio de SUNAT conectado: el sistema no valida ni refresca nada.
--
-- Por eso van junto con `rucConsultadoEn` y `rucFuenteConsulta`. Un estado de
-- RUC cacheado y nunca refrescado deja de ser un dato y pasa a ser una
-- afirmación falsa; guardando cuándo se miró, la ficha puede avisar que la
-- consulta envejeció en vez de presentarla como vigente.
--
-- `agenteRetencion`, `agentePercepcion`, `buenContribuyente` y
-- `afectacionTributaria` NO alteran ningún cálculo. Las tasas y los supuestos
-- son normativos y el negocio todavía no confirmó su régimen; hacer que
-- cambien un comprobante sería inventar una regla tributaria. Hoy son
-- información para quien emite.

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
    "documentoNormalizado" TEXT,
    "tipoPersona" TEXT,
    "tipoContribuyente" TEXT,
    "estadoRuc" TEXT,
    "condicionRuc" TEXT,
    "rucConsultadoEn" DATETIME,
    "rucFuenteConsulta" TEXT,
    "agenteRetencion" BOOLEAN NOT NULL DEFAULT false,
    "agentePercepcion" BOOLEAN NOT NULL DEFAULT false,
    "buenContribuyente" BOOLEAN NOT NULL DEFAULT false,
    "afectacionTributaria" TEXT,
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
    "medioPagoPreferido" TEXT,
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
INSERT INTO "new_clientes" ("almacenDespachoId", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "descuentoGeneralPct", "direccion", "distrito", "documentoNormalizado", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "frecuenciaReparto", "id", "limiteCredito", "medioPagoPreferido", "monedaDefecto", "motivoEstado", "motivoNivelRiesgo", "nivelRiesgo", "nombreComercial", "notas", "pais", "pedidoMinimo", "prioridadAtencion", "provincia", "razonSocial", "requiereAprobacionCredito", "requiereOrdenCompra", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "toleranciaVencimientoDias", "transportistaPreferidoId", "ubigeoId", "vendedorId", "zonaId") SELECT "almacenDespachoId", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "descuentoGeneralPct", "direccion", "distrito", "documentoNormalizado", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "frecuenciaReparto", "id", "limiteCredito", "medioPagoPreferido", "monedaDefecto", "motivoEstado", "motivoNivelRiesgo", "nivelRiesgo", "nombreComercial", "notas", "pais", "pedidoMinimo", "prioridadAtencion", "provincia", "razonSocial", "requiereAprobacionCredito", "requiereOrdenCompra", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "toleranciaVencimientoDias", "transportistaPreferidoId", "ubigeoId", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_documentoNormalizado_key" ON "clientes"("empresaId", "documentoNormalizado");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
