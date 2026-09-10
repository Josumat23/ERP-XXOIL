-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_auditoria_maestros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "entidad" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valoresAntes" TEXT,
    "valoresDespues" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_maestros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_auditoria_maestros" ("accion", "creadoEn", "empresaId", "entidad", "id", "registroId", "usuarioId", "usuarioNombre", "valoresAntes", "valoresDespues") SELECT "accion", "creadoEn", "empresaId", "entidad", "id", "registroId", "usuarioId", "usuarioNombre", "valoresAntes", "valoresDespues" FROM "auditoria_maestros";
DROP TABLE "auditoria_maestros";
ALTER TABLE "new_auditoria_maestros" RENAME TO "auditoria_maestros";
CREATE INDEX "auditoria_maestros_empresaId_entidad_registroId_creadoEn_idx" ON "auditoria_maestros"("empresaId", "entidad", "registroId", "creadoEn");
CREATE INDEX "auditoria_maestros_usuarioId_creadoEn_idx" ON "auditoria_maestros"("usuarioId", "creadoEn");
CREATE TABLE "new_categorias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_categorias" ("activo", "creadoEn", "descripcion", "empresaId", "id", "nombre") SELECT "activo", "creadoEn", "descripcion", "empresaId", "id", "nombre" FROM "categorias";
DROP TABLE "categorias";
ALTER TABLE "new_categorias" RENAME TO "categorias";
CREATE UNIQUE INDEX "categorias_empresaId_nombre_key" ON "categorias"("empresaId", "nombre");
CREATE TABLE "new_conteos_inventario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "conteos_inventario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_conteos_inventario" ("codigo", "empresaId", "fecha", "id", "usuarioId", "usuarioNombre") SELECT "codigo", "empresaId", "fecha", "id", "usuarioId", "usuarioNombre" FROM "conteos_inventario";
DROP TABLE "conteos_inventario";
ALTER TABLE "new_conteos_inventario" RENAME TO "conteos_inventario";
CREATE UNIQUE INDEX "conteos_inventario_empresaId_codigo_key" ON "conteos_inventario"("empresaId", "codigo");
CREATE TABLE "new_cuentas_bancarias_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "banco" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "numeroCuenta" TEXT NOT NULL,
    "cci" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "cuentas_bancarias_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cuentas_bancarias_empresa" ("activo", "banco", "cci", "empresaId", "id", "moneda", "numeroCuenta") SELECT "activo", "banco", "cci", "empresaId", "id", "moneda", "numeroCuenta" FROM "cuentas_bancarias_empresa";
DROP TABLE "cuentas_bancarias_empresa";
ALTER TABLE "new_cuentas_bancarias_empresa" RENAME TO "cuentas_bancarias_empresa";
CREATE INDEX "cuentas_bancarias_empresa_empresaId_numeroCuenta_idx" ON "cuentas_bancarias_empresa"("empresaId", "numeroCuenta");
CREATE TABLE "new_insumos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "esRetornable" BOOLEAN NOT NULL DEFAULT false,
    "montoDeposito" DECIMAL,
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "plazoEntregaDias" INTEGER NOT NULL DEFAULT 0,
    "cantidadMinimaCompra" DECIMAL NOT NULL DEFAULT 0,
    "multiploCompra" DECIMAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "codigoProveedor" TEXT,
    "zonaAlmacenId" TEXT,
    "notas" TEXT,
    "requiereInspeccion" BOOLEAN NOT NULL DEFAULT false,
    "esPeligroso" BOOLEAN NOT NULL DEFAULT false,
    "claseGhs" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "insumos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "insumos_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_insumos" ("activo", "actualizadoEn", "cantidadMinimaCompra", "claseGhs", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "esPeligroso", "esRetornable", "id", "moneda", "montoDeposito", "multiploCompra", "nombre", "notas", "plazoEntregaDias", "proveedorId", "requiereInspeccion", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "cantidadMinimaCompra", "claseGhs", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "esPeligroso", "esRetornable", "id", "moneda", "montoDeposito", "multiploCompra", "nombre", "notas", "plazoEntregaDias", "proveedorId", "requiereInspeccion", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId" FROM "insumos";
DROP TABLE "insumos";
ALTER TABLE "new_insumos" RENAME TO "insumos";
CREATE UNIQUE INDEX "insumos_empresaId_codigo_key" ON "insumos"("empresaId", "codigo");
CREATE TABLE "new_movimientos_casco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "movimientos_casco_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_casco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_casco_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_movimientos_casco" ("cantidad", "clienteId", "empresaId", "fecha", "id", "insumoId", "referencia", "tipo", "usuarioId", "usuarioNombre") SELECT "cantidad", "clienteId", "empresaId", "fecha", "id", "insumoId", "referencia", "tipo", "usuarioId", "usuarioNombre" FROM "movimientos_casco";
DROP TABLE "movimientos_casco";
ALTER TABLE "new_movimientos_casco" RENAME TO "movimientos_casco";
CREATE INDEX "movimientos_casco_empresaId_clienteId_insumoId_idx" ON "movimientos_casco"("empresaId", "clienteId", "insumoId");
CREATE TABLE "new_movimientos_kardex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "almacenId" TEXT NOT NULL,
    "tipoItem" TEXT NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "tipoMovimiento" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "saldoAnterior" DECIMAL NOT NULL,
    "saldoNuevo" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimientos_kardex_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_kardex_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_kardex_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "movimientos_kardex_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_movimientos_kardex" ("almacenId", "cantidad", "costoUnitario", "creadoEn", "empresaId", "fecha", "id", "insumoId", "motivo", "origen", "presentacionId", "referencia", "saldoAnterior", "saldoNuevo", "tipoItem", "tipoMovimiento", "usuarioId", "usuarioNombre") SELECT "almacenId", "cantidad", "costoUnitario", "creadoEn", "empresaId", "fecha", "id", "insumoId", "motivo", "origen", "presentacionId", "referencia", "saldoAnterior", "saldoNuevo", "tipoItem", "tipoMovimiento", "usuarioId", "usuarioNombre" FROM "movimientos_kardex";
DROP TABLE "movimientos_kardex";
ALTER TABLE "new_movimientos_kardex" RENAME TO "movimientos_kardex";
CREATE INDEX "movimientos_kardex_tipoItem_presentacionId_insumoId_idx" ON "movimientos_kardex"("tipoItem", "presentacionId", "insumoId");
CREATE INDEX "movimientos_kardex_almacenId_tipoItem_presentacionId_insumoId_idx" ON "movimientos_kardex"("almacenId", "tipoItem", "presentacionId", "insumoId");
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
    CONSTRAINT "presentaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "presentaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "presentaciones_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_presentaciones" ("activo", "actualizadoEn", "codigoBarras", "contenidoKg", "contenidoLitros", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "stockReservado", "unidadMedidaSunat", "unidadesPorCaja", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "codigoBarras", "contenidoKg", "contenidoLitros", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "stockReservado", "unidadMedidaSunat", "unidadesPorCaja", "zonaAlmacenId" FROM "presentaciones";
DROP TABLE "presentaciones";
ALTER TABLE "new_presentaciones" RENAME TO "presentaciones";
CREATE UNIQUE INDEX "presentaciones_empresaId_sku_key" ON "presentaciones"("empresaId", "sku");
CREATE TABLE "new_productos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "categoriaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadMedidaBase" TEXT NOT NULL DEFAULT 'kg',
    "segmentoMercado" TEXT,
    "marca" TEXT,
    "gradoNlgi" TEXT,
    "viscosidad" TEXT,
    "vidaUtilMeses" INTEGER,
    "fichaTecnicaUrl" TEXT,
    "hojaSeguridadUrl" TEXT,
    "notasTecnicas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "productos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_productos" ("activo", "actualizadoEn", "categoriaId", "codigo", "creadoEn", "descripcion", "empresaId", "fichaTecnicaUrl", "gradoNlgi", "hojaSeguridadUrl", "id", "marca", "nombre", "notasTecnicas", "segmentoMercado", "unidadMedidaBase", "vidaUtilMeses", "viscosidad") SELECT "activo", "actualizadoEn", "categoriaId", "codigo", "creadoEn", "descripcion", "empresaId", "fichaTecnicaUrl", "gradoNlgi", "hojaSeguridadUrl", "id", "marca", "nombre", "notasTecnicas", "segmentoMercado", "unidadMedidaBase", "vidaUtilMeses", "viscosidad" FROM "productos";
DROP TABLE "productos";
ALTER TABLE "new_productos" RENAME TO "productos";
CREATE UNIQUE INDEX "productos_empresaId_codigo_key" ON "productos"("empresaId", "codigo");
CREATE TABLE "new_proveedores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "cuentaBancaria" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proveedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_proveedores" ("activo", "banco", "cci", "condicionPagoDias", "contactoNombre", "contactoTelefono", "creadoEn", "cuentaBancaria", "direccion", "email", "empresaId", "iban", "id", "notas", "numeroCuenta", "pais", "razonSocial", "ruc", "swift", "telefono", "tipoDocumentoFiscal") SELECT "activo", "banco", "cci", "condicionPagoDias", "contactoNombre", "contactoTelefono", "creadoEn", "cuentaBancaria", "direccion", "email", "empresaId", "iban", "id", "notas", "numeroCuenta", "pais", "razonSocial", "ruc", "swift", "telefono", "tipoDocumentoFiscal" FROM "proveedores";
DROP TABLE "proveedores";
ALTER TABLE "new_proveedores" RENAME TO "proveedores";
CREATE UNIQUE INDEX "proveedores_empresaId_ruc_key" ON "proveedores"("empresaId", "ruc");
CREATE TABLE "new_usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "grupoSeguridadId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntentoFallidoEn" DATETIME,
    "bloqueadoHasta" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "usuarios_grupoSeguridadId_fkey" FOREIGN KEY ("grupoSeguridadId") REFERENCES "grupos_seguridad" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_usuarios" ("activo", "bloqueadoHasta", "creadoEn", "empresaId", "grupoSeguridadId", "id", "intentosFallidos", "nombre", "passwordHash", "rol", "ultimoIntentoFallidoEn", "usuario") SELECT "activo", "bloqueadoHasta", "creadoEn", "empresaId", "grupoSeguridadId", "id", "intentosFallidos", "nombre", "passwordHash", "rol", "ultimoIntentoFallidoEn", "usuario" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_empresaId_usuario_key" ON "usuarios"("empresaId", "usuario");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
