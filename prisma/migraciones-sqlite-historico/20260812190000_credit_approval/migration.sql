-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "estadoAprobacionCredito" TEXT NOT NULL DEFAULT 'NO_REQUERIDA';
ALTER TABLE "pedidos" ADD COLUMN "condicionPagoCredito" TEXT;
ALTER TABLE "pedidos" ADD COLUMN "deudaCreditoEvaluada" DECIMAL;
ALTER TABLE "pedidos" ADD COLUMN "montoCreditoEvaluado" DECIMAL;
ALTER TABLE "pedidos" ADD COLUMN "limiteCreditoEvaluado" DECIMAL;
ALTER TABLE "pedidos" ADD COLUMN "creditoSolicitadoEn" DATETIME;
ALTER TABLE "pedidos" ADD COLUMN "creditoResueltoEn" DATETIME;
ALTER TABLE "pedidos" ADD COLUMN "creditoResueltoPor" TEXT;
ALTER TABLE "pedidos" ADD COLUMN "motivoRechazoCredito" TEXT;