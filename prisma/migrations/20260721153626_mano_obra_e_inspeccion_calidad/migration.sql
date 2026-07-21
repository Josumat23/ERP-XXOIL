-- CreateTable
CREATE TABLE "inspecciones_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "fecha" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspecciones_compra_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_configuracion_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "razonSocial" TEXT NOT NULL DEFAULT 'Mi Empresa S.A.C.',
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "telefono" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tasaIgv" DECIMAL NOT NULL DEFAULT 18,
    "tarifaHoraManoObra" DECIMAL NOT NULL DEFAULT 0,
    "actualizadoEn" DATETIME NOT NULL
);
INSERT INTO "new_configuracion_empresa" ("actualizadoEn", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "moneda", "nombreComercial", "pais", "provincia", "razonSocial", "ruc", "sitioWeb", "tasaIgv", "telefono") SELECT "actualizadoEn", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "moneda", "nombreComercial", "pais", "provincia", "razonSocial", "ruc", "sitioWeb", "tasaIgv", "telefono" FROM "configuracion_empresa";
DROP TABLE "configuracion_empresa";
ALTER TABLE "new_configuracion_empresa" RENAME TO "configuracion_empresa";
CREATE TABLE "new_envasados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "kgConsumidos" DECIMAL NOT NULL,
    "horasManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoTotal" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "envasados_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "envasados_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_envasados" ("codigo", "costoTotal", "costoUnitario", "empresaId", "fecha", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "usuarioId", "usuarioNombre") SELECT "codigo", "costoTotal", "costoUnitario", "empresaId", "fecha", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "usuarioId", "usuarioNombre" FROM "envasados";
DROP TABLE "envasados";
ALTER TABLE "new_envasados" RENAME TO "envasados";
CREATE UNIQUE INDEX "envasados_codigo_key" ON "envasados"("codigo");
CREATE TABLE "new_insumos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "codigoProveedor" TEXT,
    "zonaAlmacenId" TEXT,
    "notas" TEXT,
    "requiereInspeccion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "insumos_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_insumos" ("activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "id", "moneda", "nombre", "notas", "proveedorId", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "id", "moneda", "nombre", "notas", "proveedorId", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId" FROM "insumos";
DROP TABLE "insumos";
ALTER TABLE "new_insumos" RENAME TO "insumos";
CREATE UNIQUE INDEX "insumos_empresaId_codigo_key" ON "insumos"("empresaId", "codigo");
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
    "horasManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoKg" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'EN_PROCESO',
    "observaciones" TEXT,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "lotes_granel_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_lotes_granel" ("codigo", "costoInsumos", "costoKg", "empresaId", "estado", "fechaFin", "fechaInicio", "formulaId", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "mermaKg", "observaciones", "usuarioId", "usuarioNombre") SELECT "codigo", "costoInsumos", "costoKg", "empresaId", "estado", "fechaFin", "fechaInicio", "formulaId", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "mermaKg", "observaciones", "usuarioId", "usuarioNombre" FROM "lotes_granel";
DROP TABLE "lotes_granel";
ALTER TABLE "new_lotes_granel" RENAME TO "lotes_granel";
CREATE UNIQUE INDEX "lotes_granel_codigo_key" ON "lotes_granel"("codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "inspecciones_compra_recepcionCompraDetalleId_key" ON "inspecciones_compra"("recepcionCompraDetalleId");
