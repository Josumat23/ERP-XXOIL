-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "intentosFallidos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuarios" ADD COLUMN "ultimoIntentoFallidoEn" DATETIME;
ALTER TABLE "usuarios" ADD COLUMN "bloqueadoHasta" DATETIME;