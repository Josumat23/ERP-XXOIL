-- Instrumentos de medición del laboratorio y su historial de calibración.
--
-- El negocio confirmó el 2026-09-17 que el laboratorio está en implementación.
-- Hasta ahora el ítem estaba en la Oleada 3, esperando exactamente ese
-- disparador ("incorporación de instrumentos de medición que la requieran").
--
-- Importa más que en otros rubros por algo concreto: desde el ciclo de la
-- densidad, el densímetro produce el número que convierte kg en litros en cada
-- comprobante. Una medición con un instrumento descalibrado no se queda en el
-- laboratorio, llega a la factura.
--
-- `configuracion_empresa.controlCalibracion` nace en FALSE: el maestro se puede
-- cargar desde ya, pero las alertas y el semáforo quedan apagados hasta que la
-- empresa encienda el control. Aditiva: no crea ni una fila.

-- CreateEnum
CREATE TYPE "ResultadoCalibracion" AS ENUM ('CONFORME', 'CONFORME_CON_AJUSTE', 'NO_CONFORME');

-- AlterTable
ALTER TABLE "configuracion_empresa" ADD COLUMN     "controlCalibracion" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "instrumentos_medicion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "serie" TEXT,
    "ubicacion" TEXT,
    "frecuenciaCalibracionDias" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instrumentos_medicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibraciones_instrumento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vigenteHasta" TIMESTAMP(3) NOT NULL,
    "resultado" "ResultadoCalibracion" NOT NULL,
    "numeroCertificado" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibraciones_instrumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instrumentos_medicion_empresaId_activo_idx" ON "instrumentos_medicion"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "instrumentos_medicion_empresaId_codigo_key" ON "instrumentos_medicion"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "calibraciones_instrumento_empresaId_instrumentoId_idx" ON "calibraciones_instrumento"("empresaId", "instrumentoId");

-- AddForeignKey
ALTER TABLE "instrumentos_medicion" ADD CONSTRAINT "instrumentos_medicion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibraciones_instrumento" ADD CONSTRAINT "calibraciones_instrumento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibraciones_instrumento" ADD CONSTRAINT "calibraciones_instrumento_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumentos_medicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
