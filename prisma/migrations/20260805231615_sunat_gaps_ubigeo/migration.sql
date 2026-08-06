-- AlterTable
ALTER TABLE "configuracion_empresa" ADD COLUMN "sunatCertificadoBase64" TEXT;
ALTER TABLE "configuracion_empresa" ADD COLUMN "sunatCertificadoPassword" TEXT;
ALTER TABLE "configuracion_empresa" ADD COLUMN "sunatClaveSol" TEXT;
ALTER TABLE "configuracion_empresa" ADD COLUMN "sunatUsuarioSol" TEXT;

-- CreateTable
CREATE TABLE "cuentas_bancarias_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "banco" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "numeroCuenta" TEXT NOT NULL,
    "cci" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "nota_credito_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notaCreditoId" TEXT NOT NULL,
    "pedidoDetalleId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "nota_credito_detalles_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "notas_credito" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nota_credito_detalles_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ubigeos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guias_remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" DATETIME NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "ubigeoPartidaId" TEXT,
    "ubigeoLlegadaId" TEXT,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "pesoBrutoTotal" DECIMAL NOT NULL DEFAULT 0,
    "modalidadTransporte" TEXT NOT NULL DEFAULT 'PRIVADO',
    "transportista" TEXT,
    "transportistaRuc" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "equipoId" TEXT,
    "estadoDespacho" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "fechaSalida" DATETIME,
    "fechaEntrega" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoPartidaId_fkey" FOREIGN KEY ("ubigeoPartidaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoLlegadaId_fkey" FOREIGN KEY ("ubigeoLlegadaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_guias_remision" ("clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "motivoTraslado", "numero", "observaciones", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "usuarioId", "usuarioNombre") SELECT "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "motivoTraslado", "numero", "observaciones", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "usuarioId", "usuarioNombre" FROM "guias_remision";
DROP TABLE "guias_remision";
ALTER TABLE "new_guias_remision" RENAME TO "guias_remision";
CREATE UNIQUE INDEX "guias_remision_numero_key" ON "guias_remision"("numero");
CREATE TABLE "new_notas_credito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "tipoNota" TEXT NOT NULL DEFAULT 'OTROS_CONCEPTOS',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "notas_credito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_notas_credito" ("empresaId", "facturaId", "fecha", "id", "monto", "motivo", "numero", "usuarioId", "usuarioNombre") SELECT "empresaId", "facturaId", "fecha", "id", "monto", "motivo", "numero", "usuarioId", "usuarioNombre" FROM "notas_credito";
DROP TABLE "notas_credito";
ALTER TABLE "new_notas_credito" RENAME TO "notas_credito";
CREATE UNIQUE INDEX "notas_credito_numero_key" ON "notas_credito"("numero");
CREATE TABLE "new_presentaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenidoKg" DECIMAL NOT NULL,
    "contenidoLitros" DECIMAL,
    "unidadMedidaSunat" TEXT NOT NULL DEFAULT 'NIU',
    "precio" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockReservado" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL NOT NULL DEFAULT 0,
    "codigoBarras" TEXT,
    "pesoBrutoKg" DECIMAL,
    "unidadesPorCaja" INTEGER,
    "zonaAlmacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "presentaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "presentaciones_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_presentaciones" ("activo", "actualizadoEn", "codigoBarras", "contenidoKg", "contenidoLitros", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "stockReservado", "unidadesPorCaja", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "codigoBarras", "contenidoKg", "contenidoLitros", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "stockReservado", "unidadesPorCaja", "zonaAlmacenId" FROM "presentaciones";
DROP TABLE "presentaciones";
ALTER TABLE "new_presentaciones" RENAME TO "presentaciones";
CREATE UNIQUE INDEX "presentaciones_empresaId_sku_key" ON "presentaciones"("empresaId", "sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ubigeos_codigo_key" ON "ubigeos"("codigo");
