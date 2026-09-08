ALTER TABLE "cuentas_por_pagar" ADD COLUMN "estadoVerificacion" TEXT NOT NULL DEFAULT 'COINCIDE';
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "verificacionResueltaPorId" TEXT;
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "verificacionResueltaPorNombre" TEXT;
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "verificacionResueltaEn" DATETIME;
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "motivoExcepcion" TEXT;
