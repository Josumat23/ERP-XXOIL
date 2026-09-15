-- Seguimiento del aviso de cobranza.
--
-- avisos_cobranza era un log de avisos emitidos: se sabia a quien se le habia
-- escrito y nunca que habia contestado. Estas columnas registran la respuesta.
--
-- Todas son aditivas y nacen nulas o con default: los avisos ya emitidos
-- quedan en PENDIENTE, que es exactamente lo que son (emitidos, sin respuesta
-- registrada). Ninguna fila existente cambia de significado.
--
-- El incumplimiento de un compromiso NO se guarda: se deriva de la fecha y del
-- saldo de la factura. Un estado guardado se queda viejo apenas cambia
-- cualquiera de los dos.

ALTER TABLE "avisos_cobranza" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "avisos_cobranza" ADD COLUMN "compromisoPagoEn" DATETIME;
ALTER TABLE "avisos_cobranza" ADD COLUMN "detalleRespuesta" TEXT;
ALTER TABLE "avisos_cobranza" ADD COLUMN "respondidoEn" DATETIME;
ALTER TABLE "avisos_cobranza" ADD COLUMN "respondidoPorId" TEXT;
ALTER TABLE "avisos_cobranza" ADD COLUMN "respondidoPorNombre" TEXT;
