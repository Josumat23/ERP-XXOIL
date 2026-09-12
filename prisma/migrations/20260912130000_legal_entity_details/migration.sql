-- Datos de la entidad legal que la razon social y el RUC no cubren:
-- representante legal, su documento y el regimen tributario.
--
-- Son referencia informativa. No gobiernan ningun calculo ni bloquean
-- ninguna operacion: el sistema no infiere obligaciones tributarias a partir
-- del regimen. Mismo criterio que el registro de OSINERGMIN ya existente.
-- Columnas nulas y aditivas: nada cambia de comportamiento al aplicarla.

ALTER TABLE "configuracion_empresa" ADD COLUMN "regimenTributario" TEXT;
ALTER TABLE "configuracion_empresa" ADD COLUMN "representanteLegal" TEXT;
ALTER TABLE "configuracion_empresa" ADD COLUMN "representanteLegalDocumento" TEXT;

