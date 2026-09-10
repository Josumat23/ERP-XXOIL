DROP INDEX "proyectos_codigo_key";
CREATE UNIQUE INDEX "proyectos_empresaId_codigo_key" ON "proyectos"("empresaId", "codigo");
