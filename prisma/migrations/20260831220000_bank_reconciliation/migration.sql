ALTER TABLE "movimientos_caja" ADD COLUMN "cuentaBancariaId" TEXT REFERENCES "cuentas_bancarias_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "movimientos_caja_cuentaBancariaId_fecha_idx" ON "movimientos_caja"("cuentaBancariaId", "fecha");
CREATE INDEX "cuentas_bancarias_empresa_empresaId_numeroCuenta_idx" ON "cuentas_bancarias_empresa"("empresaId", "numeroCuenta");

CREATE TABLE "conciliaciones_bancarias" (
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
  CONSTRAINT "conciliaciones_bancarias_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conciliaciones_bancarias_cuentaBancariaId_fechaDesde_fechaHasta_key" ON "conciliaciones_bancarias"("cuentaBancariaId", "fechaDesde", "fechaHasta");
CREATE INDEX "conciliaciones_bancarias_empresaId_estado_idx" ON "conciliaciones_bancarias"("empresaId", "estado");

CREATE TABLE "movimientos_extracto_bancario" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conciliacionId" TEXT NOT NULL,
  "fecha" DATETIME NOT NULL,
  "tipo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "referencia" TEXT,
  "monto" DECIMAL NOT NULL,
  "huella" TEXT NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movimientos_extracto_bancario_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "conciliaciones_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "movimientos_extracto_bancario_conciliacionId_huella_key" ON "movimientos_extracto_bancario"("conciliacionId", "huella");
CREATE INDEX "movimientos_extracto_bancario_conciliacionId_fecha_idx" ON "movimientos_extracto_bancario"("conciliacionId", "fecha");

CREATE TABLE "conciliaciones_bancarias_aplicaciones" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "movimientoExtractoId" TEXT NOT NULL,
  "movimientoCajaId" TEXT NOT NULL,
  "monto" DECIMAL NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conciliaciones_bancarias_aplicaciones_movimientoExtractoId_fkey" FOREIGN KEY ("movimientoExtractoId") REFERENCES "movimientos_extracto_bancario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "conciliaciones_bancarias_aplicaciones_movimientoCajaId_fkey" FOREIGN KEY ("movimientoCajaId") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conciliaciones_bancarias_aplicaciones_movimientoExtractoId_movimientoCajaId_key" ON "conciliaciones_bancarias_aplicaciones"("movimientoExtractoId", "movimientoCajaId");
CREATE INDEX "conciliaciones_bancarias_aplicaciones_movimientoCajaId_idx" ON "conciliaciones_bancarias_aplicaciones"("movimientoCajaId");