-- Picking por oleadas: preparar varias guias en una sola recorrida.
--
-- Tablas nuevas, sin filas. Ninguna guia existente cambia.
--
-- El picking NO mueve el kardex: la salida de inventario la hace la guia
-- cuando el camion sale. Lo que mueve es la capa de zonas, sacando el item de
-- su zona hacia "sin zona", que es donde esta mientras espera en la playa de
-- despacho.


-- CreateTable
CREATE TABLE "oleadas_picking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" DATETIME,
    "completadaPorId" TEXT,
    "completadaPorNombre" TEXT,
    "motivoCancelacion" TEXT,
    CONSTRAINT "oleadas_picking_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "oleadas_picking_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "oleada_picking_guias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oleadaId" TEXT NOT NULL,
    "guiaId" TEXT NOT NULL,
    CONSTRAINT "oleada_picking_guias_oleadaId_fkey" FOREIGN KEY ("oleadaId") REFERENCES "oleadas_picking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "oleada_picking_guias_guiaId_fkey" FOREIGN KEY ("guiaId") REFERENCES "guias_remision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "picking_lineas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oleadaId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidadRequerida" DECIMAL NOT NULL,
    "cantidadPickeada" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "picking_lineas_oleadaId_fkey" FOREIGN KEY ("oleadaId") REFERENCES "oleadas_picking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "picking_lineas_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "oleadas_picking_empresaId_estado_idx" ON "oleadas_picking"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "oleadas_picking_empresaId_numero_key" ON "oleadas_picking"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "oleada_picking_guias_guiaId_idx" ON "oleada_picking_guias"("guiaId");

-- CreateIndex
CREATE UNIQUE INDEX "oleada_picking_guias_oleadaId_guiaId_key" ON "oleada_picking_guias"("oleadaId", "guiaId");

-- CreateIndex
CREATE UNIQUE INDEX "picking_lineas_oleadaId_presentacionId_key" ON "picking_lineas"("oleadaId", "presentacionId");

