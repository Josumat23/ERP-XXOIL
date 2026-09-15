DROP INDEX "conteos_inventario_codigo_key";
CREATE UNIQUE INDEX "conteos_inventario_empresaId_codigo_key" ON "conteos_inventario"("empresaId", "codigo");
