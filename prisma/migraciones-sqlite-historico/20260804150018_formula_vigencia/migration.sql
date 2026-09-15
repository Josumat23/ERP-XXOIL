-- AlterTable
ALTER TABLE "formulas" ADD COLUMN "vigenteDesde" DATETIME;
ALTER TABLE "formulas" ADD COLUMN "vigenteHasta" DATETIME;

-- Backfill: las versiones activas existentes se consideran vigentes desde su creación
UPDATE "formulas" SET "vigenteDesde" = "creadoEn" WHERE "activo" = 1;
