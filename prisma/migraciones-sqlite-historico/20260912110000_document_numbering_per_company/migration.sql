-- Numeracion de documentos por compania.
--
-- Quince documentos numerados tenian su numero/codigo con indice unico GLOBAL,
-- no por compania. Con una sola sociedad no se notaba; con dos, dos companias
-- no podian tener cada una su PED-00001, y la numeracion de una continuaba
-- desde el maximo de la otra.
--
-- Cada indice unico de una columna pasa a ser compuesto (empresaId, numero).
-- Es el mismo patron que ya usaban Cliente, Empleado y Proyecto.
--
-- OrdenMantenimiento es el unico de los quince que no tenia empresaId propio:
-- colgaba solo del equipo. Se le agrega la columna y se rellena desde el
-- equipo de cada orden, ANTES de crear su indice compuesto.

-- DropIndex
DROP INDEX "asientos_contables_numero_key";

-- DropIndex
DROP INDEX "cotizaciones_numero_key";

-- DropIndex
DROP INDEX "devoluciones_cliente_numero_key";

-- DropIndex
DROP INDEX "envasados_codigo_key";

-- DropIndex
DROP INDEX "facturas_numero_key";

-- DropIndex
DROP INDEX "guias_remision_numero_key";

-- DropIndex
DROP INDEX "hojas_ruta_numero_key";

-- DropIndex
DROP INDEX "lotes_granel_codigo_key";

-- DropIndex
DROP INDEX "notas_credito_numero_key";

-- DropIndex
DROP INDEX "ordenes_compra_numero_key";

-- DropIndex
DROP INDEX "ordenes_internas_codigo_key";

-- DropIndex
DROP INDEX "pedidos_numero_key";

-- DropIndex
DROP INDEX "recepciones_compra_numero_key";

-- DropIndex
DROP INDEX "reclamos_cliente_numero_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ordenes_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADA',
    "descripcion" TEXT NOT NULL,
    "fechaProgramada" DATETIME NOT NULL,
    "duracionDias" INTEGER NOT NULL DEFAULT 1,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoRepuestos" DECIMAL NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "modoFalla" TEXT,
    "causaFalla" TEXT,
    "tiempoParadaHoras" DECIMAL,
    "tecnicoResponsable" TEXT,
    "centroCostoId" TEXT,
    "planMantenimientoId" TEXT,
    "avisoMantenimientoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_mantenimiento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "planes_mantenimiento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_avisoMantenimientoId_fkey" FOREIGN KEY ("avisoMantenimientoId") REFERENCES "avisos_mantenimiento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ordenes_mantenimiento" ("avisoMantenimientoId", "causaFalla", "centroCostoId", "codigo", "costoManoObra", "costoRepuestos", "creadoEn", "descripcion", "duracionDias", "equipoId", "estado", "fechaFin", "fechaInicio", "fechaProgramada", "id", "modoFalla", "observaciones", "planMantenimientoId", "tecnicoResponsable", "tiempoParadaHoras", "tipo", "usuarioId", "usuarioNombre") SELECT "avisoMantenimientoId", "causaFalla", "centroCostoId", "codigo", "costoManoObra", "costoRepuestos", "creadoEn", "descripcion", "duracionDias", "equipoId", "estado", "fechaFin", "fechaInicio", "fechaProgramada", "id", "modoFalla", "observaciones", "planMantenimientoId", "tecnicoResponsable", "tiempoParadaHoras", "tipo", "usuarioId", "usuarioNombre" FROM "ordenes_mantenimiento";
DROP TABLE "ordenes_mantenimiento";
ALTER TABLE "new_ordenes_mantenimiento" RENAME TO "ordenes_mantenimiento";
-- Cada orden hereda la compania de su equipo. Las que no tengan equipo valido
-- (no deberia haberlas: equipoId es obligatorio) se quedan con el default "1".
UPDATE "ordenes_mantenimiento"
SET "empresaId" = COALESCE(
  (SELECT e."empresaId" FROM "equipos" e WHERE e."id" = "ordenes_mantenimiento"."equipoId"),
  '1'
);
CREATE UNIQUE INDEX "ordenes_mantenimiento_avisoMantenimientoId_key" ON "ordenes_mantenimiento"("avisoMantenimientoId");
CREATE UNIQUE INDEX "ordenes_mantenimiento_empresaId_codigo_key" ON "ordenes_mantenimiento"("empresaId", "codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "asientos_contables_empresaId_numero_key" ON "asientos_contables"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_empresaId_numero_key" ON "cotizaciones"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_cliente_empresaId_numero_key" ON "devoluciones_cliente"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "envasados_empresaId_codigo_key" ON "envasados"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_empresaId_numero_key" ON "facturas"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "guias_remision_empresaId_numero_key" ON "guias_remision"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "hojas_ruta_empresaId_numero_key" ON "hojas_ruta"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_granel_empresaId_codigo_key" ON "lotes_granel"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "notas_credito_empresaId_numero_key" ON "notas_credito"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_empresaId_numero_key" ON "ordenes_compra"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_internas_empresaId_codigo_key" ON "ordenes_internas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_empresaId_numero_key" ON "pedidos"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_compra_empresaId_numero_key" ON "recepciones_compra"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "reclamos_cliente_empresaId_numero_key" ON "reclamos_cliente"("empresaId", "numero");

