-- SQLite stores enums as TEXT; existing rows remain unchanged.
ALTER TABLE "lotes_granel" ADD COLUMN "fechaCancelacion" DATETIME;
ALTER TABLE "lotes_granel" ADD COLUMN "motivoCancelacion" TEXT;
ALTER TABLE "lotes_granel" ADD COLUMN "usuarioCancelacionId" TEXT;
ALTER TABLE "lotes_granel" ADD COLUMN "usuarioCancelacionNombre" TEXT;
