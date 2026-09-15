ALTER TABLE "devoluciones_compra" ADD COLUMN "montoFuncional" DECIMAL NOT NULL DEFAULT 0;

CREATE TABLE "creditos_proveedor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "proveedorId" TEXT NOT NULL,
  "devolucionCompraId" TEXT NOT NULL,
  "montoFuncionalOriginal" DECIMAL NOT NULL,
  "saldoFuncional" DECIMAL NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creditos_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "creditos_proveedor_devolucionCompraId_fkey" FOREIGN KEY ("devolucionCompraId") REFERENCES "devoluciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "creditos_proveedor_devolucionCompraId_key" ON "creditos_proveedor"("devolucionCompraId");
CREATE INDEX "creditos_proveedor_proveedorId_estado_idx" ON "creditos_proveedor"("proveedorId", "estado");

CREATE TABLE "aplicaciones_credito_proveedor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "creditoId" TEXT NOT NULL,
  "cuentaPorPagarId" TEXT NOT NULL,
  "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "montoFuncional" DECIMAL NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  CONSTRAINT "aplicaciones_credito_proveedor_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aplicaciones_credito_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "aplicaciones_credito_proveedor_creditoId_idx" ON "aplicaciones_credito_proveedor"("creditoId");
CREATE INDEX "aplicaciones_credito_proveedor_cuentaPorPagarId_idx" ON "aplicaciones_credito_proveedor"("cuentaPorPagarId");

CREATE TABLE "reembolsos_proveedor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" TEXT NOT NULL DEFAULT '1',
  "creditoId" TEXT NOT NULL,
  "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "montoFuncional" DECIMAL NOT NULL,
  "medioPago" TEXT NOT NULL,
  "referencia" TEXT,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  CONSTRAINT "reembolsos_proveedor_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "reembolsos_proveedor_creditoId_idx" ON "reembolsos_proveedor"("creditoId");

-- Reconstruye devoluciones históricas creadas por la versión anterior. Esa
-- versión descontaba montoCredito (moneda de OC) de una CxP funcional en PEN
-- y reducía también el total documental. Se recompone el total original, se
-- conserva el pago ejecutado y se reconoce únicamente el exceso económico.
UPDATE "devoluciones_compra"
SET "montoFuncional" = ROUND(
  "montoCredito" * COALESCE((
    SELECT oc."tipoCambio"
    FROM "recepcion_compra_detalles" rd
    JOIN "recepciones_compra" r ON r."id" = rd."recepcionId"
    JOIN "ordenes_compra" oc ON oc."id" = r."ordenCompraId"
    WHERE rd."id" = "devoluciones_compra"."recepcionCompraDetalleId"
  ), 1), 2
);

CREATE TEMP TABLE "_reconstruccion_creditos_proveedor" AS
SELECT r."id" AS "recepcionId", c."id" AS "cuentaPorPagarId",
  SUM(d."montoCredito") AS "devolucionAnterior",
  SUM(d."montoFuncional") AS "devolucionFuncional",
  CASE WHEN c."id" IS NULL THEN 0 ELSE MAX(0, c."total" + SUM(d."montoCredito") - COALESCE((
    SELECT SUM(p."monto") FROM "pagos_proveedor" p
    WHERE p."cuentaPorPagarId" = c."id"
      AND p."estadoAprobacion" IN ('NO_REQUERIDA', 'APROBADA')
  ), 0)) END AS "saldoAntesDevoluciones",
  CASE WHEN c."id" IS NULL THEN 0 ELSE c."total" + SUM(d."montoCredito") END AS "totalOriginal"
FROM "devoluciones_compra" d
JOIN "recepcion_compra_detalles" rd ON rd."id" = d."recepcionCompraDetalleId"
JOIN "recepciones_compra" r ON r."id" = rd."recepcionId"
LEFT JOIN "cuentas_por_pagar" c ON c."recepcionCompraId" = r."id"
GROUP BY r."id", c."id";

UPDATE "cuentas_por_pagar"
SET "total" = (SELECT x."totalOriginal" FROM "_reconstruccion_creditos_proveedor" x WHERE x."cuentaPorPagarId" = "cuentas_por_pagar"."id"),
  "saldo" = MAX(0, (SELECT x."saldoAntesDevoluciones" - x."devolucionFuncional" FROM "_reconstruccion_creditos_proveedor" x WHERE x."cuentaPorPagarId" = "cuentas_por_pagar"."id")),
  "estado" = CASE WHEN (SELECT x."saldoAntesDevoluciones" - x."devolucionFuncional" FROM "_reconstruccion_creditos_proveedor" x WHERE x."cuentaPorPagarId" = "cuentas_por_pagar"."id") <= 0 THEN 'PAGADA' ELSE 'PENDIENTE' END
WHERE "id" IN (SELECT "cuentaPorPagarId" FROM "_reconstruccion_creditos_proveedor" WHERE "cuentaPorPagarId" IS NOT NULL);

INSERT INTO "creditos_proveedor" ("id", "empresaId", "proveedorId", "devolucionCompraId", "montoFuncionalOriginal", "saldoFuncional", "estado")
SELECT lower(hex(randomblob(16))), oc."empresaId", oc."proveedorId", d."id",
  MAX(0, MAX(0, (SELECT SUM(d2."montoFuncional") FROM "devoluciones_compra" d2 JOIN "recepcion_compra_detalles" rd2 ON rd2."id" = d2."recepcionCompraDetalleId" WHERE rd2."recepcionId" = r."id" AND (d2."creadoEn" < d."creadoEn" OR (d2."creadoEn" = d."creadoEn" AND d2."id" <= d."id"))) - x."saldoAntesDevoluciones") - MAX(0, COALESCE((SELECT SUM(d2."montoFuncional") FROM "devoluciones_compra" d2 JOIN "recepcion_compra_detalles" rd2 ON rd2."id" = d2."recepcionCompraDetalleId" WHERE rd2."recepcionId" = r."id" AND (d2."creadoEn" < d."creadoEn" OR (d2."creadoEn" = d."creadoEn" AND d2."id" < d."id"))), 0) - x."saldoAntesDevoluciones")),
  MAX(0, MAX(0, (SELECT SUM(d2."montoFuncional") FROM "devoluciones_compra" d2 JOIN "recepcion_compra_detalles" rd2 ON rd2."id" = d2."recepcionCompraDetalleId" WHERE rd2."recepcionId" = r."id" AND (d2."creadoEn" < d."creadoEn" OR (d2."creadoEn" = d."creadoEn" AND d2."id" <= d."id"))) - x."saldoAntesDevoluciones") - MAX(0, COALESCE((SELECT SUM(d2."montoFuncional") FROM "devoluciones_compra" d2 JOIN "recepcion_compra_detalles" rd2 ON rd2."id" = d2."recepcionCompraDetalleId" WHERE rd2."recepcionId" = r."id" AND (d2."creadoEn" < d."creadoEn" OR (d2."creadoEn" = d."creadoEn" AND d2."id" < d."id"))), 0) - x."saldoAntesDevoluciones")),
  'DISPONIBLE'
FROM "devoluciones_compra" d
JOIN "recepcion_compra_detalles" rd ON rd."id" = d."recepcionCompraDetalleId"
JOIN "recepciones_compra" r ON r."id" = rd."recepcionId"
JOIN "ordenes_compra" oc ON oc."id" = r."ordenCompraId"
JOIN "_reconstruccion_creditos_proveedor" x ON x."recepcionId" = r."id"
WHERE MAX(0, MAX(0, (SELECT SUM(d2."montoFuncional") FROM "devoluciones_compra" d2 JOIN "recepcion_compra_detalles" rd2 ON rd2."id" = d2."recepcionCompraDetalleId" WHERE rd2."recepcionId" = r."id" AND (d2."creadoEn" < d."creadoEn" OR (d2."creadoEn" = d."creadoEn" AND d2."id" <= d."id"))) - x."saldoAntesDevoluciones") - MAX(0, COALESCE((SELECT SUM(d2."montoFuncional") FROM "devoluciones_compra" d2 JOIN "recepcion_compra_detalles" rd2 ON rd2."id" = d2."recepcionCompraDetalleId" WHERE rd2."recepcionId" = r."id" AND (d2."creadoEn" < d."creadoEn" OR (d2."creadoEn" = d."creadoEn" AND d2."id" < d."id"))), 0) - x."saldoAntesDevoluciones")) > 0;

DROP TABLE "_reconstruccion_creditos_proveedor";
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo")
SELECT lower(hex(randomblob(16))), p."id", '1689',
       'Otras cuentas por cobrar — saldos a favor en proveedores', 'ACTIVO'
FROM "planes_cuentas" p
WHERE p."esMaestro" = 1
  AND p."id" = (
    SELECT p2."id" FROM "planes_cuentas" p2
    WHERE p2."empresaId" = p."empresaId" AND p2."esMaestro" = 1
    ORDER BY p2."creadoEn", p2."id" LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" c
    WHERE c."planCuentasId" = p."id" AND c."codigo" = '1689'
  );

INSERT INTO "controles_contables" ("id", "empresaId", "clave", "cuentaId")
SELECT lower(hex(randomblob(16))), p."empresaId", 'SALDOS_FAVOR_PROVEEDORES', c."id"
FROM "planes_cuentas" p
JOIN "cuentas_contables" c ON c."planCuentasId" = p."id" AND c."codigo" = '1689'
WHERE p."esMaestro" = 1
  AND p."id" = (
    SELECT p2."id" FROM "planes_cuentas" p2
    WHERE p2."empresaId" = p."empresaId" AND p2."esMaestro" = 1
    ORDER BY p2."creadoEn", p2."id" LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "controles_contables" cc
    WHERE cc."empresaId" = p."empresaId" AND cc."clave" = 'SALDOS_FAVOR_PROVEEDORES'
  );
