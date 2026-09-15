-- Cuentas y controles contables de planilla.
--
-- Seis claves de ControlContable se usaban en los asientos de planilla,
-- gratificacion, CTS y liquidacion pero NUNCA se sembraron. Como postearAsiento
-- es best-effort, la operacion no fallaba: el asiento se descartaba en silencio
-- y solo quedaba la IncidenciaContable. En una instalacion nueva, la
-- contabilidad de planilla no salia.
--
-- Es la tercera aparicion de la misma clase de defecto en este repositorio,
-- despues de seed-ubigeos.ts que nadie ejecutaba y del almacen de tipo PLANTA
-- que el seed no creaba.
--
-- Las cuentas son un valor inicial razonable del PCGE, no una afirmacion: el
-- control se reapunta desde Finanzas -> Plan de cuentas, que es donde el
-- contador decide. Idempotente: no pisa una cuenta ni un control que ya exista.

-- 1. Las cuentas, en el plan de cada compania que no las tenga.
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo", "activo")
SELECT
  'cuenta-' || nuevas."codigo" || '-' || p."id",
  p."id",
  nuevas."codigo",
  nuevas."nombre",
  nuevas."tipo",
  true
FROM "planes_cuentas" p
CROSS JOIN (
  SELECT '6211' AS "codigo", 'Sueldos y salarios' AS "nombre", 'GASTO' AS "tipo"
  UNION ALL SELECT '4031', 'EsSalud por pagar', 'PASIVO'
  UNION ALL SELECT '4032', 'ONP / AFP por pagar', 'PASIVO'
  UNION ALL SELECT '40173', 'Renta de quinta categoria por pagar', 'PASIVO'
  UNION ALL SELECT '4111', 'Sueldos y salarios por pagar', 'PASIVO'
  UNION ALL SELECT '4151', 'Compensacion por tiempo de servicios por pagar', 'PASIVO'
) AS nuevas
WHERE NOT EXISTS (
  SELECT 1 FROM "cuentas_contables" c
  WHERE c."planCuentasId" = p."id" AND c."codigo" = nuevas."codigo"
);

-- 2. Los controles, apuntando a la cuenta del plan de SU propia compania.
INSERT INTO "controles_contables" ("id", "empresaId", "clave", "cuentaId")
SELECT
  'control-' || mapa."clave" || '-' || p."empresaId",
  p."empresaId",
  mapa."clave",
  c."id"
FROM "planes_cuentas" p
CROSS JOIN (
  SELECT 'GASTO_PERSONAL' AS "clave", '6211' AS "codigo"
  UNION ALL SELECT 'ESSALUD_POR_PAGAR', '4031'
  UNION ALL SELECT 'ONP_AFP_POR_PAGAR', '4032'
  UNION ALL SELECT 'RETENCION_5TA_POR_PAGAR', '40173'
  UNION ALL SELECT 'SUELDOS_POR_PAGAR', '4111'
  UNION ALL SELECT 'CTS_POR_PAGAR', '4151'
) AS mapa
JOIN "cuentas_contables" c
  ON c."planCuentasId" = p."id" AND c."codigo" = mapa."codigo"
WHERE NOT EXISTS (
  SELECT 1 FROM "controles_contables" x
  WHERE x."empresaId" = p."empresaId" AND x."clave" = mapa."clave"
);
