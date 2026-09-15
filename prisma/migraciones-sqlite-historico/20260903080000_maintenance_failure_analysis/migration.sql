ALTER TABLE "ordenes_mantenimiento" ADD COLUMN "modoFalla" TEXT;
ALTER TABLE "ordenes_mantenimiento" ADD COLUMN "causaFalla" TEXT;
ALTER TABLE "ordenes_mantenimiento" ADD COLUMN "tiempoParadaHoras" DECIMAL;
ALTER TABLE "ordenes_mantenimiento" ADD COLUMN "tecnicoResponsable" TEXT;
