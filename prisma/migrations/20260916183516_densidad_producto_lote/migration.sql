-- AlterTable
ALTER TABLE "lotes_granel" ADD COLUMN     "densidadKgL" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "densidadKgL" DECIMAL(65,30),
ADD COLUMN     "temperaturaReferenciaC" DECIMAL(65,30);
