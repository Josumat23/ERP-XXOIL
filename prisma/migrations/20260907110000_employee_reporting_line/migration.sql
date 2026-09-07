ALTER TABLE "empleados"
ADD COLUMN "jefeDirectoId" TEXT REFERENCES "empleados"("id") ON DELETE SET NULL;

CREATE INDEX "empleados_jefeDirectoId_idx" ON "empleados"("jefeDirectoId");
