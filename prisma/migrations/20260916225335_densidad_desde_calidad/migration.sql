-- Marca cuál de las mediciones del plan de inspección ES la densidad del lote.
--
-- El laboratorio ya la medía: quedaba en resultados_caracteristica_calidad y
-- nadie la leía. La densidad que gobierna la conversión a litros de cada
-- comprobante se tecleaba aparte al finalizar el lote — es decir, ANTES de
-- medirla. Dos fuentes para el mismo hecho, y ganaba la provisional.
--
-- Aditiva: todos los planes existentes quedan en false, que es su
-- comportamiento de hoy. Reversible con DROP COLUMN.

-- AlterTable
ALTER TABLE "caracteristicas_plan_calidad" ADD COLUMN     "esDensidad" BOOLEAN NOT NULL DEFAULT false;
