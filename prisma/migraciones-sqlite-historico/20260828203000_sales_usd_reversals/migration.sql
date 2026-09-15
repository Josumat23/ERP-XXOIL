ALTER TABLE "notas_credito" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'PEN';
ALTER TABLE "notas_credito" ADD COLUMN "tipoCambio" DECIMAL NOT NULL DEFAULT 1;
ALTER TABLE "notas_credito" ADD COLUMN "montoFuncional" DECIMAL NOT NULL DEFAULT 0;
UPDATE "notas_credito"
SET "moneda"=COALESCE((SELECT "moneda" FROM "facturas" WHERE "facturas"."id"="notas_credito"."facturaId"),'PEN'),
    "tipoCambio"=COALESCE((SELECT "tipoCambio" FROM "facturas" WHERE "facturas"."id"="notas_credito"."facturaId"),1),
    "montoFuncional"=ROUND("monto"*COALESCE((SELECT "tipoCambio" FROM "facturas" WHERE "facturas"."id"="notas_credito"."facturaId"),1),2);
ALTER TABLE "recargos_mora" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'PEN';
ALTER TABLE "recargos_mora" ADD COLUMN "tipoCambio" DECIMAL NOT NULL DEFAULT 1;
ALTER TABLE "recargos_mora" ADD COLUMN "montoFuncional" DECIMAL NOT NULL DEFAULT 0;
UPDATE "recargos_mora"
SET "moneda"=COALESCE((SELECT "moneda" FROM "facturas" WHERE "facturas"."id"="recargos_mora"."facturaId"),'PEN'),
    "tipoCambio"=COALESCE((SELECT "tipoCambio" FROM "facturas" WHERE "facturas"."id"="recargos_mora"."facturaId"),1),
    "montoFuncional"=ROUND("monto"*COALESCE((SELECT "tipoCambio" FROM "facturas" WHERE "facturas"."id"="recargos_mora"."facturaId"),1),2);