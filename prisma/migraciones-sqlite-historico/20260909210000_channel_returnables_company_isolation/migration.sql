PRAGMA foreign_keys=OFF;

CREATE TABLE "new_descuentos_canal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "canal" TEXT NOT NULL,
    "descuentoPct" DECIMAL NOT NULL DEFAULT 0
);

INSERT INTO "new_descuentos_canal" ("id", "empresaId", "canal", "descuentoPct")
SELECT "id", '1', "canal", "descuentoPct" FROM "descuentos_canal";

DROP TABLE "descuentos_canal";
ALTER TABLE "new_descuentos_canal" RENAME TO "descuentos_canal";
CREATE UNIQUE INDEX "descuentos_canal_empresaId_canal_key" ON "descuentos_canal"("empresaId", "canal");

ALTER TABLE "movimientos_casco" ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT '1';
CREATE INDEX "movimientos_casco_empresaId_clienteId_insumoId_idx" ON "movimientos_casco"("empresaId", "clienteId", "insumoId");

PRAGMA foreign_keys=ON;
