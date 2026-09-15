-- Licitacion de flete: comparar cotizaciones de transportistas para un tramo
-- antes de contratarlo. Mismas reglas que el RFQ de compras (dos ofertas
-- minimo, justificacion escrita, quien solicita no adjudica).
--
-- Tablas nuevas y una columna opcional en guias_remision. Sin filas: ninguna
-- guia existente cambia. El monto acordado NO se copia a la guia, se lee de
-- la oferta adjudicada.


-- CreateTable
CREATE TABLE "licitaciones_flete" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "ubigeoOrigenId" TEXT,
    "ubigeoDestinoId" TEXT,
    "fechaRequerida" DATETIME NOT NULL,
    "pesoEstimadoKg" DECIMAL NOT NULL,
    "fechaLimite" DATETIME,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "justificacionAdjudicacion" TEXT,
    "motivoDesierta" TEXT,
    "adjudicadaEn" DATETIME,
    "adjudicadaPorId" TEXT,
    "adjudicadaPorNombre" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "licitaciones_flete_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "licitaciones_flete_ubigeoOrigenId_fkey" FOREIGN KEY ("ubigeoOrigenId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "licitaciones_flete_ubigeoDestinoId_fkey" FOREIGN KEY ("ubigeoDestinoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ofertas_flete" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "licitacionId" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "diasTransito" INTEGER NOT NULL,
    "validaHasta" DATETIME,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PRESENTADA',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ofertas_flete_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "licitaciones_flete" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ofertas_flete_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guias_remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "pedidoId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" DATETIME NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "ubigeoPartidaId" TEXT,
    "ubigeoLlegadaId" TEXT,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "pesoBrutoTotal" DECIMAL NOT NULL DEFAULT 0,
    "modalidadTransporte" TEXT NOT NULL DEFAULT 'PRIVADO',
    "transportistaId" TEXT,
    "licitacionFleteId" TEXT,
    "transportista" TEXT,
    "transportistaRuc" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "equipoId" TEXT,
    "estadoDespacho" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "fechaSalida" DATETIME,
    "fechaEntrega" DATETIME,
    "anuladaEn" DATETIME,
    "anuladaPorId" TEXT,
    "anuladaPorNombre" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guias_remision_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_licitacionFleteId_fkey" FOREIGN KEY ("licitacionFleteId") REFERENCES "licitaciones_flete" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoPartidaId_fkey" FOREIGN KEY ("ubigeoPartidaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoLlegadaId_fkey" FOREIGN KEY ("ubigeoLlegadaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_guias_remision" ("anuladaEn", "anuladaPorId", "anuladaPorNombre", "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "modalidadTransporte", "motivoAnulacion", "motivoTraslado", "numero", "observaciones", "pedidoId", "pesoBrutoTotal", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "transportistaId", "transportistaRuc", "ubigeoLlegadaId", "ubigeoPartidaId", "usuarioId", "usuarioNombre") SELECT "anuladaEn", "anuladaPorId", "anuladaPorNombre", "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "modalidadTransporte", "motivoAnulacion", "motivoTraslado", "numero", "observaciones", "pedidoId", "pesoBrutoTotal", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "transportistaId", "transportistaRuc", "ubigeoLlegadaId", "ubigeoPartidaId", "usuarioId", "usuarioNombre" FROM "guias_remision";
DROP TABLE "guias_remision";
ALTER TABLE "new_guias_remision" RENAME TO "guias_remision";
CREATE INDEX "guias_remision_pedidoId_idx" ON "guias_remision"("pedidoId");
CREATE UNIQUE INDEX "guias_remision_empresaId_numero_key" ON "guias_remision"("empresaId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "licitaciones_flete_empresaId_numero_key" ON "licitaciones_flete"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ofertas_flete_licitacionId_transportistaId_key" ON "ofertas_flete"("licitacionId", "transportistaId");

