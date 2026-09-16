-- CreateTable
CREATE TABLE "reanalisis_envasado" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "envasadoId" TEXT NOT NULL,
    "vencimientoAnterior" TIMESTAMP(3) NOT NULL,
    "vencimientoNuevo" TIMESTAMP(3) NOT NULL,
    "resultado" "ResultadoCalidad" NOT NULL,
    "planInspeccionId" TEXT,
    "planVersion" INTEGER,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "reanalisis_envasado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reanalisis_envasado_envasadoId_idx" ON "reanalisis_envasado"("envasadoId");

-- AddForeignKey
ALTER TABLE "reanalisis_envasado" ADD CONSTRAINT "reanalisis_envasado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reanalisis_envasado" ADD CONSTRAINT "reanalisis_envasado_envasadoId_fkey" FOREIGN KEY ("envasadoId") REFERENCES "envasados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reanalisis_envasado" ADD CONSTRAINT "reanalisis_envasado_planInspeccionId_fkey" FOREIGN KEY ("planInspeccionId") REFERENCES "planes_inspeccion_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
