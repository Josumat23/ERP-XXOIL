CREATE TABLE "rfq_compras" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "numero" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "fechaLimite" DATETIME,
  "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
  "justificacionAdjudicacion" TEXT,
  "adjudicadaEn" DATETIME,
  "adjudicadaPorId" TEXT,
  "adjudicadaPorNombre" TEXT,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "rfq_compras_empresaId_numero_key" ON "rfq_compras"("empresaId", "numero");

CREATE TABLE "rfq_compra_lineas" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rfqId" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "cantidad" DECIMAL NOT NULL,
  CONSTRAINT "rfq_compra_lineas_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfq_compras"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rfq_compra_lineas_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rfq_compra_lineas_rfqId_insumoId_key" ON "rfq_compra_lineas"("rfqId", "insumoId");

CREATE TABLE "ofertas_rfq" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rfqId" TEXT NOT NULL,
  "proveedorId" TEXT NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'PEN',
  "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
  "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
  "plazoEntregaDias" INTEGER NOT NULL,
  "total" DECIMAL NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PRESENTADA',
  "notas" TEXT,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ofertas_rfq_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfq_compras"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ofertas_rfq_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ofertas_rfq_rfqId_proveedorId_key" ON "ofertas_rfq"("rfqId", "proveedorId");

CREATE TABLE "oferta_rfq_lineas" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ofertaId" TEXT NOT NULL,
  "rfqLineaId" TEXT NOT NULL,
  "costoUnitario" DECIMAL NOT NULL,
  "subtotal" DECIMAL NOT NULL,
  CONSTRAINT "oferta_rfq_lineas_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "ofertas_rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "oferta_rfq_lineas_rfqLineaId_fkey" FOREIGN KEY ("rfqLineaId") REFERENCES "rfq_compra_lineas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "oferta_rfq_lineas_ofertaId_rfqLineaId_key" ON "oferta_rfq_lineas"("ofertaId", "rfqLineaId");

ALTER TABLE "ordenes_compra" ADD COLUMN "rfqId" TEXT REFERENCES "rfq_compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ordenes_compra_rfqId_key" ON "ordenes_compra"("rfqId");
