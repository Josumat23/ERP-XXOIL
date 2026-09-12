-- Cuenta propia para el aporte patronal a EsSalud.
--
-- El asiento de planilla imputaba el aporte patronal a la MISMA cuenta que la
-- remuneracion (6211), porque usaba una sola clave de control para los dos. En
-- el PCGE el aporte patronal es una contribucion social y vive en 627, no en
-- 621: no es remuneracion del trabajador.
--
-- Solo afecta a los asientos NUEVOS. Los ya contabilizados no se reescriben:
-- un asiento emitido es historia, y moverlo de cuenta cambiaria balances de
-- periodos posiblemente cerrados. Si el contador quiere corregir los
-- anteriores, es un asiento de reclasificacion, que es una decision suya.
--
-- Idempotente y sin pisar nada: si la compania ya tiene la cuenta 6271 o ya
-- configuro este control, se respetan.

INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo", "activo")
SELECT 'cuenta-6271-' || p."id", p."id", '6271', 'Regimen de prestaciones de salud', 'GASTO', true
FROM "planes_cuentas" p
WHERE NOT EXISTS (
  SELECT 1 FROM "cuentas_contables" c
  WHERE c."planCuentasId" = p."id" AND c."codigo" = '6271'
);

INSERT INTO "controles_contables" ("id", "empresaId", "clave", "cuentaId")
SELECT 'control-essalud-patronal-' || p."empresaId", p."empresaId", 'GASTO_ESSALUD_PATRONAL', c."id"
FROM "planes_cuentas" p
JOIN "cuentas_contables" c ON c."planCuentasId" = p."id" AND c."codigo" = '6271'
WHERE NOT EXISTS (
  SELECT 1 FROM "controles_contables" x
  WHERE x."empresaId" = p."empresaId" AND x."clave" = 'GASTO_ESSALUD_PATRONAL'
);
