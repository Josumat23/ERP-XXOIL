-- Especificaciones técnicas del rubro (API, ACEA, JASO, SAE, ISO, NLGI, OEM) y
-- qué declara cada producto sobre ellas.
--
-- Hasta ahora esto vivía en `productos.notasTecnicas`, texto libre. Servía para
-- que una persona lo leyera y para nada más: no se puede filtrar, no se puede
-- responder "qué productos cubren ACEA E9", y sobre todo no distingue CUMPLE de
-- HOMOLOGADO — que en lubricantes son cosas distintas: el primero es una
-- declaración propia, el segundo una aprobación de un tercero con número y
-- vigencia verificables.
--
-- Aditiva y vacía: no crea ni una fila. Qué códigos existen, cuáles siguen
-- vigentes y cuáles cumple cada producto lo carga el negocio. `notasTecnicas`
-- se conserva intacto.

-- CreateEnum
CREATE TYPE "OrganismoEspecificacion" AS ENUM ('API', 'ACEA', 'JASO', 'SAE', 'ISO', 'NLGI', 'OEM', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoCumplimientoEspecificacion" AS ENUM ('CUMPLE', 'HOMOLOGADO');

-- CreateTable
CREATE TABLE "especificaciones_tecnicas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "organismo" "OrganismoEspecificacion" NOT NULL,
    "codigo" TEXT NOT NULL,
    "emisor" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "especificaciones_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especificaciones_producto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "especificacionId" TEXT NOT NULL,
    "tipo" "TipoCumplimientoEspecificacion" NOT NULL,
    "numeroAprobacion" TEXT,
    "vigenteHasta" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "especificaciones_producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "especificaciones_tecnicas_empresaId_activo_idx" ON "especificaciones_tecnicas"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "especificaciones_tecnicas_empresaId_organismo_codigo_key" ON "especificaciones_tecnicas"("empresaId", "organismo", "codigo");

-- CreateIndex
CREATE INDEX "especificaciones_producto_empresaId_productoId_idx" ON "especificaciones_producto"("empresaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "especificaciones_producto_productoId_especificacionId_key" ON "especificaciones_producto"("productoId", "especificacionId");

-- AddForeignKey
ALTER TABLE "especificaciones_tecnicas" ADD CONSTRAINT "especificaciones_tecnicas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificaciones_producto" ADD CONSTRAINT "especificaciones_producto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificaciones_producto" ADD CONSTRAINT "especificaciones_producto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificaciones_producto" ADD CONSTRAINT "especificaciones_producto_especificacionId_fkey" FOREIGN KEY ("especificacionId") REFERENCES "especificaciones_tecnicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
