-- CreateTable
CREATE TABLE "tanques" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "almacenId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "capacidadKg" DECIMAL(65,30) NOT NULL,
    "contenidoKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tanques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aportes_tanque" (
    "id" TEXT NOT NULL,
    "tanqueId" TEXT NOT NULL,
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "cantidadKg" DECIMAL(65,30) NOT NULL,
    "cantidadInicialKg" DECIMAL(65,30) NOT NULL,
    "ingresadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aportes_tanque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tanques_empresaId_codigo_key" ON "tanques"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "aportes_tanque_tanqueId_idx" ON "aportes_tanque"("tanqueId");

-- AddForeignKey
ALTER TABLE "tanques" ADD CONSTRAINT "tanques_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanques" ADD CONSTRAINT "tanques_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanques" ADD CONSTRAINT "tanques_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aportes_tanque" ADD CONSTRAINT "aportes_tanque_tanqueId_fkey" FOREIGN KEY ("tanqueId") REFERENCES "tanques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aportes_tanque" ADD CONSTRAINT "aportes_tanque_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
