-- Tipo y vencimiento de los documentos adjuntos.
--
-- Dos columnas opcionales sobre el DMS que ya existe, que sirve a siete
-- pantallas: la mayoría de los adjuntos son simplemente archivos y siguen
-- funcionando igual.
--
-- La lista de tipos sale de lo que el negocio pidió guardar del cliente
-- —contrato, ficha RUC, constancia bancaria, licencias y certificados— y no
-- de una clasificación inventada.
--
-- El vencimiento NO bloquea nada: avisa. Impedir vender a un cliente porque
-- alguien no actualizó un PDF sería inventar una regla de negocio que nadie
-- pidió; dejar que un contrato venza sin que nadie se entere es el problema
-- que esto resuelve.

-- AlterTable
ALTER TABLE "adjuntos" ADD COLUMN "tipoDocumento" TEXT;
ALTER TABLE "adjuntos" ADD COLUMN "venceEl" DATETIME;
