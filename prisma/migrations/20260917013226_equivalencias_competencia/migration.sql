-- Productos de la competencia, lo que sus fichas declaran cumplir, y qué
-- producto propio se declara equivalente a cuál.
--
-- La pregunta que más se repite en una venta de lubricantes —«¿cuál es tu
-- equivalente al Delvac 1340?»— no se podía contestar desde el sistema. La
-- respuesta fácil es una tabla de sinónimos, que es lo que hacen los ERP
-- genéricos con sus cross-references: si alguien pregunta POR QUÉ son
-- equivalentes, la respuesta es «porque alguien lo tecleó».
--
-- Acá la equivalencia se apoya en las especificaciones que las dos fichas
-- declaran. El sistema calcula la cobertura y guarda la que había al
-- declararla; la equivalencia la declara una persona, porque decir que dos
-- lubricantes se reemplazan es criterio técnico, no aritmética.
--
-- Aditiva y vacía: no crea ni una fila.

-- CreateTable
CREATE TABLE "productos_competencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fuente" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especificaciones_competencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "productoCompetenciaId" TEXT NOT NULL,
    "especificacionId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "especificaciones_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equivalencias_producto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoCompetenciaId" TEXT NOT NULL,
    "justificacion" TEXT,
    "cubiertasAlDeclarar" INTEGER NOT NULL,
    "totalAlDeclarar" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equivalencias_producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "productos_competencia_empresaId_activo_idx" ON "productos_competencia"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_competencia_empresaId_marca_nombre_key" ON "productos_competencia"("empresaId", "marca", "nombre");

-- CreateIndex
CREATE INDEX "especificaciones_competencia_empresaId_productoCompetenciaI_idx" ON "especificaciones_competencia"("empresaId", "productoCompetenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "especificaciones_competencia_productoCompetenciaId_especifi_key" ON "especificaciones_competencia"("productoCompetenciaId", "especificacionId");

-- CreateIndex
CREATE INDEX "equivalencias_producto_empresaId_productoId_idx" ON "equivalencias_producto"("empresaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "equivalencias_producto_productoId_productoCompetenciaId_key" ON "equivalencias_producto"("productoId", "productoCompetenciaId");

-- AddForeignKey
ALTER TABLE "productos_competencia" ADD CONSTRAINT "productos_competencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificaciones_competencia" ADD CONSTRAINT "especificaciones_competencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificaciones_competencia" ADD CONSTRAINT "especificaciones_competencia_productoCompetenciaId_fkey" FOREIGN KEY ("productoCompetenciaId") REFERENCES "productos_competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificaciones_competencia" ADD CONSTRAINT "especificaciones_competencia_especificacionId_fkey" FOREIGN KEY ("especificacionId") REFERENCES "especificaciones_tecnicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_producto" ADD CONSTRAINT "equivalencias_producto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_producto" ADD CONSTRAINT "equivalencias_producto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equivalencias_producto" ADD CONSTRAINT "equivalencias_producto_productoCompetenciaId_fkey" FOREIGN KEY ("productoCompetenciaId") REFERENCES "productos_competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
