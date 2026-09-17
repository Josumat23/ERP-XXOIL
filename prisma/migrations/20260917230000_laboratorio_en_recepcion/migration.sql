-- Con qué instrumento se mide lo que ENTRA.
--
-- El laboratorio ya registraba el instrumento de los ensayos de producción
-- —liberación del lote y re-análisis del envasado— pero no el de la inspección
-- de recepción. Es el mismo laboratorio y son los mismos equipos: una
-- calibración vencida no distingue entre lo que se compra y lo que se fabrica.
--
-- Sin esto, el aceite base aceptado con un viscosímetro descalibrado no
-- aparecía en ninguna lista, y la pregunta «¿qué midió este instrumento?»
-- devolvía una respuesta incompleta sin avisar.
--
-- Aditiva: dos columnas opcionales. Las inspecciones ya registradas quedan en
-- NULL, que es la verdad — no se sabe con qué se midieron.

-- AlterTable
ALTER TABLE "caracteristicas_plan_insumo" ADD COLUMN     "instrumentoId" TEXT;

-- AlterTable
ALTER TABLE "mediciones_inspeccion_compra" ADD COLUMN     "instrumentoId" TEXT;

-- AddForeignKey
ALTER TABLE "caracteristicas_plan_insumo" ADD CONSTRAINT "caracteristicas_plan_insumo_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumentos_medicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediciones_inspeccion_compra" ADD CONSTRAINT "mediciones_inspeccion_compra_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumentos_medicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
