-- El control de calibración pasa de un interruptor a tres niveles.
--
-- Decisión del negocio (2026-09-17): dos opciones —bloquea o advierte— no
-- alcanzan. Hace falta una tercera, «no aplica», para que el proceso siga su
-- curso mientras el laboratorio se implementa. El laboratorio informa siempre;
-- frenar la liberación de un lote es algo que la empresa elige, no algo que el
-- sistema imponga.
--
-- El booleano se reemplaza en vez de convivir con el nivel: dos fuentes para
-- el mismo hecho terminan discrepando, y es el defecto que este proyecto ya
-- corrigió con la densidad.
--
-- La conversión es fiel a lo que hacía cada valor: encendido avisaba en el
-- semáforo y no frenaba nada, que es exactamente ADVIERTE. Revertir esta
-- migración es el camino inverso (ADVIERTE y BLOQUEA vuelven a `true`).

-- CreateEnum
CREATE TYPE "NivelControlCalibracion" AS ENUM ('NO_APLICA', 'ADVIERTE', 'BLOQUEA');

-- AlterTable
ALTER TABLE "configuracion_empresa" ADD COLUMN "nivelControlCalibracion" "NivelControlCalibracion" NOT NULL DEFAULT 'NO_APLICA';

UPDATE "configuracion_empresa"
   SET "nivelControlCalibracion" = 'ADVIERTE'
 WHERE "controlCalibracion" = true;

ALTER TABLE "configuracion_empresa" DROP COLUMN "controlCalibracion";
