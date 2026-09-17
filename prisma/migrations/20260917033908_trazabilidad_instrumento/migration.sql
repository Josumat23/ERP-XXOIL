-- Con qué instrumento se espera medir cada característica del plan, y con cuál
-- se midió de verdad en cada ensayo.
--
-- Es la mitad que faltaba del laboratorio. Hasta ahora el sistema sabía que un
-- instrumento estaba vencido y sabía qué densidad se había medido, pero no los
-- unía: no podía contestar «¿qué lotes se liberaron con este instrumento?»,
-- que es la pregunta del día que una calibración vuelve fuera de tolerancia.
--
-- El ESTADO de calibración de ese momento no se guarda: se deriva del historial
-- del instrumento. Guardarlo congelaría una respuesta que mejora sola a medida
-- que se carga el historial —justo lo que va a pasar mientras el laboratorio se
-- pone en marcha— y podría discrepar del ledger sin que nada lo avise.
--
-- Aditiva: dos columnas opcionales. Los ensayos ya registrados quedan en NULL,
-- que es la verdad — no se sabe con qué se midieron.

-- AlterTable
ALTER TABLE "caracteristicas_plan_calidad" ADD COLUMN     "instrumentoId" TEXT;

-- AlterTable
ALTER TABLE "resultados_caracteristica_calidad" ADD COLUMN     "instrumentoId" TEXT;

-- AddForeignKey
ALTER TABLE "caracteristicas_plan_calidad" ADD CONSTRAINT "caracteristicas_plan_calidad_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumentos_medicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_caracteristica_calidad" ADD CONSTRAINT "resultados_caracteristica_calidad_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumentos_medicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
