-- SQLite stores enums as TEXT; existing orders remain EN_PROCESO and new code may use PLANIFICADO.
ALTER TABLE "lotes_granel" ADD COLUMN "fechaCreacion" DATETIME;
ALTER TABLE "lotes_granel" ADD COLUMN "fechaLiberacion" DATETIME;
ALTER TABLE "lotes_granel" ADD COLUMN "usuarioLiberacionId" TEXT;
ALTER TABLE "lotes_granel" ADD COLUMN "usuarioLiberacionNombre" TEXT;
