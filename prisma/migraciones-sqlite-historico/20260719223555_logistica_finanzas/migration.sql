-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "total" DECIMAL NOT NULL,
    "notas" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orden_compra_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordenCompraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "cantidadRecibida" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "orden_compra_detalles_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orden_compra_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recepciones_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "recepciones_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recepcion_compra_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recepcionId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL,
    CONSTRAINT "recepcion_compra_detalles_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "recepciones_compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recepcion_compra_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guias_remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" DATETIME NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "transportista" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guia_remision_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guiaId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    CONSTRAINT "guia_remision_detalles_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "guias_remision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guia_remision_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cuentas_por_pagar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT NOT NULL,
    "ordenCompraId" TEXT,
    "numeroDocumento" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "total" DECIMAL NOT NULL,
    "saldo" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "cuentas_por_pagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cuentas_por_pagar_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pagos_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "cuentaPorPagarId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "pagos_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "hojas_ruta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PLANIFICADA',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hojas_ruta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hoja_ruta_visitas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hojaRutaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "objetivo" TEXT,
    "resultado" TEXT,
    CONSTRAINT "hoja_ruta_visitas_hojaRutaId_fkey" FOREIGN KEY ("hojaRutaId") REFERENCES "hojas_ruta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "hoja_ruta_visitas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_envasados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "kgConsumidos" DECIMAL NOT NULL,
    "costoTotal" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "envasados_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "envasados_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_envasados" ("codigo", "empresaId", "fecha", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "usuarioId", "usuarioNombre") SELECT "codigo", "empresaId", "fecha", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "usuarioId", "usuarioNombre" FROM "envasados";
DROP TABLE "envasados";
ALTER TABLE "new_envasados" RENAME TO "envasados";
CREATE UNIQUE INDEX "envasados_codigo_key" ON "envasados"("codigo");
CREATE TABLE "new_lotes_granel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "kgObjetivo" DECIMAL NOT NULL,
    "kgProducidos" DECIMAL NOT NULL DEFAULT 0,
    "mermaKg" DECIMAL NOT NULL DEFAULT 0,
    "kgDisponibles" DECIMAL NOT NULL DEFAULT 0,
    "costoInsumos" DECIMAL NOT NULL DEFAULT 0,
    "costoKg" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'EN_PROCESO',
    "observaciones" TEXT,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "lotes_granel_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_lotes_granel" ("codigo", "empresaId", "estado", "fechaFin", "fechaInicio", "formulaId", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "mermaKg", "observaciones", "usuarioId", "usuarioNombre") SELECT "codigo", "empresaId", "estado", "fechaFin", "fechaInicio", "formulaId", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "mermaKg", "observaciones", "usuarioId", "usuarioNombre" FROM "lotes_granel";
DROP TABLE "lotes_granel";
ALTER TABLE "new_lotes_granel" RENAME TO "lotes_granel";
CREATE UNIQUE INDEX "lotes_granel_codigo_key" ON "lotes_granel"("codigo");
CREATE TABLE "new_presentaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenidoKg" DECIMAL NOT NULL,
    "precio" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "presentaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_presentaciones" ("activo", "actualizadoEn", "contenidoKg", "creadoEn", "empresaId", "id", "moneda", "nombre", "precio", "productoId", "sku", "stock", "stockMinimo") SELECT "activo", "actualizadoEn", "contenidoKg", "creadoEn", "empresaId", "id", "moneda", "nombre", "precio", "productoId", "sku", "stock", "stockMinimo" FROM "presentaciones";
DROP TABLE "presentaciones";
ALTER TABLE "new_presentaciones" RENAME TO "presentaciones";
CREATE UNIQUE INDEX "presentaciones_empresaId_sku_key" ON "presentaciones"("empresaId", "sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_compra_numero_key" ON "recepciones_compra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "guias_remision_numero_key" ON "guias_remision"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "hojas_ruta_numero_key" ON "hojas_ruta"("numero");
