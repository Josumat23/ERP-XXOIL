-- Qué se midió en el re-análisis de un envasado.
--
-- Hasta ahora el re-análisis registraba que se ensayó —contra qué plan, con
-- qué versión, quién y cuándo— pero no QUÉ DIO. Extender una vigencia 333 días
-- con eso es una afirmación sin evidencia: exactamente lo que este proyecto
-- viene corrigiendo en homologaciones, equivalencias y calibraciones.
--
-- Las lecturas van a la MISMA tabla que las del lote granel, y no a una nueva.
-- Son la misma cosa medida en dos momentos: partirlas obligaría a unir dos
-- tablas cada vez que se pregunta «¿qué midió este instrumento?», y la
-- consulta que se olvidara de una devolvería una respuesta incompleta sin
-- avisar.
--
-- Aditiva y reversible: una columna opcional más, y la que ataba la lectura al
-- control de calidad pasa a admitir NULL. Las lecturas ya registradas no se
-- tocan: siguen colgando de su control.

-- AlterTable
ALTER TABLE "resultados_caracteristica_calidad" ADD COLUMN     "reanalisisId" TEXT,
ALTER COLUMN "controlCalidadId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "resultados_caracteristica_calidad_reanalisisId_secuencia_key" ON "resultados_caracteristica_calidad"("reanalisisId", "secuencia");

-- AddForeignKey
ALTER TABLE "resultados_caracteristica_calidad" ADD CONSTRAINT "resultados_caracteristica_calidad_reanalisisId_fkey" FOREIGN KEY ("reanalisisId") REFERENCES "reanalisis_envasado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una lectura pertenece a UN ensayo: o al control del lote granel, o al
-- re-análisis del envasado. Nunca a los dos, nunca a ninguno.
--
-- Va en la base y no solo en el código: una lectura huérfana no la ve nadie
-- —no aparece en ninguna pantalla, porque todas entran por su padre— y sería
-- un dato que existe y no se puede encontrar. Prisma no modela CHECK, así que
-- esta línea es la única que lo garantiza.
ALTER TABLE "resultados_caracteristica_calidad"
  ADD CONSTRAINT "resultados_caracteristica_calidad_un_solo_ensayo"
  CHECK (num_nonnulls("controlCalidadId", "reanalisisId") = 1);
