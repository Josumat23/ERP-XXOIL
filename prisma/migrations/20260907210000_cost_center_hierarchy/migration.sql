ALTER TABLE "centros_costo" ADD COLUMN "parentId" TEXT REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "centros_costo_parentId_idx" ON "centros_costo"("parentId");
