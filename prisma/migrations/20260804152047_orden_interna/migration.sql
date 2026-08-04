-- CreateTable
CREATE TABLE "ordenes_internas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "presupuesto" DECIMAL,
    "totalAcumulado" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLiquidacion" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_internas_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orden_interna_costos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordenInternaId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "orden_interna_costos_ordenInternaId_fkey" FOREIGN KEY ("ordenInternaId") REFERENCES "ordenes_internas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_internas_codigo_key" ON "ordenes_internas"("codigo");
