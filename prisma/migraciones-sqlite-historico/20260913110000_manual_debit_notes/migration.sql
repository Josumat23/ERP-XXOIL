-- Notas de debito emitidas a mano: aumento de valor (tipo 02) y penalidad
-- (tipo 03) del Catalogo 10 de SUNAT.
--
-- Dos cambios sobre notas_debito:
--
-- 1. recargoMoraId pasa a ser NULL-able. Solo la nota de tipo 01 nace de un
--    recargo por mora ya aplicado; las otras dos las emite una persona y no
--    tienen recargo detras. El indice UNIQUE se conserva: SQLite y PostgreSQL
--    tratan cada NULL como distinto, asi que muchas notas pueden no tener
--    recargo mientras un recargo sigue admitiendo una sola nota.
--
-- 2. Desglose baseImponible / igv / afectoIgv. Una nota por aumento de valor
--    puede estar afecta a IGV; la de mora documenta un recargo ya aplicado y
--    nunca llevo.
--
-- Relleno de las filas existentes: baseImponible = monto, igv = 0,
-- afectoIgv = false. Es exactamente el comportamiento que tenian, no una
-- reinterpretacion de lo ya emitido.
--
-- La FK del recargo se declara RESTRICT y no el SET NULL que corresponderia
-- por defecto a una relacion opcional: una nota que quedara con NULL al
-- borrarse su recargo seria indistinguible de una emitida a mano.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_notas_debito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "recargoMoraId" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseImponible" DECIMAL NOT NULL,
    "igv" DECIMAL NOT NULL DEFAULT 0,
    "afectoIgv" BOOLEAN NOT NULL DEFAULT false,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "tipoNota" TEXT NOT NULL DEFAULT 'INTERES_MORA',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "notas_debito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notas_debito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notas_debito_recargoMoraId_fkey" FOREIGN KEY ("recargoMoraId") REFERENCES "recargos_mora" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_notas_debito" ("id", "empresaId", "numero", "facturaId", "recargoMoraId", "fecha", "baseImponible", "igv", "afectoIgv", "monto", "moneda", "tipoCambio", "montoFuncional", "motivo", "tipoNota", "usuarioId", "usuarioNombre")
SELECT "id", "empresaId", "numero", "facturaId", "recargoMoraId", "fecha", "monto", 0, false, "monto", "moneda", "tipoCambio", "montoFuncional", "motivo", "tipoNota", "usuarioId", "usuarioNombre"
FROM "notas_debito";

DROP TABLE "notas_debito";
ALTER TABLE "new_notas_debito" RENAME TO "notas_debito";
CREATE UNIQUE INDEX "notas_debito_recargoMoraId_key" ON "notas_debito"("recargoMoraId");
CREATE UNIQUE INDEX "notas_debito_empresaId_numero_key" ON "notas_debito"("empresaId", "numero");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Cuenta e imputacion para la penalidad. Un aumento de valor es mas venta
-- (7011, control VENTAS ya existente); una penalidad no es ni venta ni
-- interes, asi que va a otros ingresos de gestion. El control es
-- reapuntable desde Finanzas -> Plan de cuentas: la cuenta exacta es
-- criterio del contador, aqui solo hay un valor inicial razonable.
INSERT INTO "cuentas_contables" ("id", "planCuentasId", "codigo", "nombre", "tipo", "activo")
SELECT 'cuenta-7599-' || p."id", p."id", '7599', 'Otros ingresos de gestion', 'INGRESO', true
FROM "planes_cuentas" p
WHERE NOT EXISTS (
  SELECT 1 FROM "cuentas_contables" c WHERE c."planCuentasId" = p."id" AND c."codigo" = '7599'
);

INSERT INTO "controles_contables" ("id", "empresaId", "clave", "cuentaId")
SELECT 'control-penalidad-' || p."empresaId", p."empresaId", 'INGRESO_PENALIDAD', c."id"
FROM "planes_cuentas" p
JOIN "cuentas_contables" c ON c."planCuentasId" = p."id" AND c."codigo" = '7599'
WHERE NOT EXISTS (
  SELECT 1 FROM "controles_contables" x WHERE x."empresaId" = p."empresaId" AND x."clave" = 'INGRESO_PENALIDAD'
);
