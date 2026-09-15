ALTER TABLE "planilla_detalles" ADD COLUMN "diasAsistenciaAprobada" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "planilla_detalles" ADD COLUMN "diasAusenciaJustificada" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "planilla_detalles" ADD COLUMN "minutosTardanza" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "planilla_detalles" ADD COLUMN "minutosSobretiempo" INTEGER NOT NULL DEFAULT 0;
