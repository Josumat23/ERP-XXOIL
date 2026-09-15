ALTER TABLE "lotes_granel" ADD COLUMN "costoReproceso" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "lotes_granel" ADD COLUMN "disposicionRechazo" TEXT;
ALTER TABLE "lotes_granel" ADD COLUMN "motivoDisposicion" TEXT;
ALTER TABLE "lotes_granel" ADD COLUMN "fechaDisposicion" DATETIME;
ALTER TABLE "lotes_granel" ADD COLUMN "usuarioDisposicionId" TEXT;
ALTER TABLE "lotes_granel" ADD COLUMN "usuarioDisposicionNombre" TEXT;
-- Activa los controles productivos en cada empresa que ya tenga un PCGE maestro.
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo")
SELECT lower(hex(randomblob(16))), p."id", '2311', 'Productos en proceso', 'ACTIVO'
FROM "planes_cuentas" p
WHERE p."esMaestro" = 1 AND NOT EXISTS (
  SELECT 1 FROM "cuentas_contables" c WHERE c."planCuentasId" = p."id" AND c."codigo" = '2311'
);
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo")
SELECT lower(hex(randomblob(16))), p."id", '7911', 'Cargas imputables a cuentas de costos', 'INGRESO'
FROM "planes_cuentas" p
WHERE p."esMaestro" = 1 AND NOT EXISTS (
  SELECT 1 FROM "cuentas_contables" c WHERE c."planCuentasId" = p."id" AND c."codigo" = '7911'
);
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo")
SELECT lower(hex(randomblob(16))), p."id", '6599', 'Otras pérdidas de gestión — producción rechazada', 'GASTO'
FROM "planes_cuentas" p
WHERE p."esMaestro" = 1 AND NOT EXISTS (
  SELECT 1 FROM "cuentas_contables" c WHERE c."planCuentasId" = p."id" AND c."codigo" = '6599'
);

INSERT INTO "controles_contables" ("id", "empresaId", "clave", "cuentaId")
SELECT lower(hex(randomblob(16))), p."empresaId", x."clave", c."id"
FROM "planes_cuentas" p
JOIN (
  SELECT 'WIP_PRODUCCION' AS "clave", '2311' AS "codigo"
  UNION ALL SELECT 'COSTOS_PRODUCCION_APLICADOS', '7911'
  UNION ALL SELECT 'PERDIDA_PRODUCCION', '6599'
) x
JOIN "cuentas_contables" c ON c."planCuentasId" = p."id" AND c."codigo" = x."codigo"
WHERE p."esMaestro" = 1
  AND p."id" = (
    SELECT p2."id" FROM "planes_cuentas" p2
    WHERE p2."empresaId" = p."empresaId" AND p2."esMaestro" = 1
    ORDER BY p2."creadoEn", p2."id" LIMIT 1
  )
  AND NOT EXISTS (
  SELECT 1 FROM "controles_contables" cc WHERE cc."empresaId" = p."empresaId" AND cc."clave" = x."clave"
);