-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conciliaciones_bancarias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "cuentaBancariaId" TEXT NOT NULL,
    "fechaDesde" DATETIME NOT NULL,
    "fechaHasta" DATETIME NOT NULL,
    "saldoInicialExtracto" DECIMAL NOT NULL,
    "saldoFinalExtracto" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "cerradaEn" DATETIME,
    "cerradaPorId" TEXT,
    "cerradaPorNombre" TEXT,
    "anuladaEn" DATETIME,
    "anuladaPorId" TEXT,
    "anuladaPorNombre" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conciliaciones_bancarias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conciliaciones_bancarias_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias_empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_conciliaciones_bancarias" ("anuladaEn", "anuladaPorId", "anuladaPorNombre", "cerradaEn", "cerradaPorId", "cerradaPorNombre", "creadoEn", "cuentaBancariaId", "empresaId", "estado", "fechaDesde", "fechaHasta", "id", "motivoAnulacion", "saldoFinalExtracto", "saldoInicialExtracto", "usuarioId", "usuarioNombre") SELECT "anuladaEn", "anuladaPorId", "anuladaPorNombre", "cerradaEn", "cerradaPorId", "cerradaPorNombre", "creadoEn", "cuentaBancariaId", "empresaId", "estado", "fechaDesde", "fechaHasta", "id", "motivoAnulacion", "saldoFinalExtracto", "saldoInicialExtracto", "usuarioId", "usuarioNombre" FROM "conciliaciones_bancarias";
DROP TABLE "conciliaciones_bancarias";
ALTER TABLE "new_conciliaciones_bancarias" RENAME TO "conciliaciones_bancarias";
CREATE INDEX "conciliaciones_bancarias_empresaId_estado_idx" ON "conciliaciones_bancarias"("empresaId", "estado");
CREATE UNIQUE INDEX "conciliaciones_bancarias_cuentaBancariaId_fechaDesde_fechaHasta_key" ON "conciliaciones_bancarias"("cuentaBancariaId", "fechaDesde", "fechaHasta");
CREATE TABLE "new_hojas_ruta" (
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
    CONSTRAINT "hojas_ruta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "hojas_ruta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_hojas_ruta" ("creadoEn", "empresaId", "estado", "fecha", "id", "notas", "numero", "usuarioId", "usuarioNombre", "vendedorId") SELECT "creadoEn", "empresaId", "estado", "fecha", "id", "notas", "numero", "usuarioId", "usuarioNombre", "vendedorId" FROM "hojas_ruta";
DROP TABLE "hojas_ruta";
ALTER TABLE "new_hojas_ruta" RENAME TO "hojas_ruta";
CREATE UNIQUE INDEX "hojas_ruta_numero_key" ON "hojas_ruta"("numero");
CREATE TABLE "new_movimientos_caja" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "montoOriginal" DECIMAL,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "cuentaBancariaId" TEXT,
    CONSTRAINT "movimientos_caja_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_caja_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias_empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_movimientos_caja" ("concepto", "cuentaBancariaId", "empresaId", "fecha", "id", "medioPago", "moneda", "monto", "montoOriginal", "referencia", "tipo", "tipoCambio", "usuarioId", "usuarioNombre") SELECT "concepto", "cuentaBancariaId", "empresaId", "fecha", "id", "medioPago", "moneda", "monto", "montoOriginal", "referencia", "tipo", "tipoCambio", "usuarioId", "usuarioNombre" FROM "movimientos_caja";
DROP TABLE "movimientos_caja";
ALTER TABLE "new_movimientos_caja" RENAME TO "movimientos_caja";
CREATE INDEX "movimientos_caja_cuentaBancariaId_fecha_idx" ON "movimientos_caja"("cuentaBancariaId", "fecha");
CREATE TABLE "new_series_documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipoDocumento" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "correlativoActual" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "series_documento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_series_documento" ("activo", "correlativoActual", "creadoEn", "empresaId", "id", "serie", "tipoDocumento") SELECT "activo", "correlativoActual", "creadoEn", "empresaId", "id", "serie", "tipoDocumento" FROM "series_documento";
DROP TABLE "series_documento";
ALTER TABLE "new_series_documento" RENAME TO "series_documento";
CREATE UNIQUE INDEX "series_documento_empresaId_tipoDocumento_serie_key" ON "series_documento"("empresaId", "tipoDocumento", "serie");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
