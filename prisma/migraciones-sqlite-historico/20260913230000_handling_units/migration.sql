-- Unidades de manipulacion: el pallet, la caja o la jaula como cosa con
-- nombre.
--
-- Tercera capa aditiva sobre el stock, con la misma forma que las dos que ya
-- existian:
--
--   saldoAlmacen = suma(saldoZona) + sinZona
--   saldoZona    = suma(contenido de las HU de esa zona) + suelto
--
-- Lo que hay en una HU YA esta contado en el saldo de su zona. Tablas nuevas
-- sin filas: ningun saldo existente cambia.


-- CreateTable
CREATE TABLE "unidades_manipulacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PALLET',
    "zonaAlmacenId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_ALMACEN',
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "unidades_manipulacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "unidades_manipulacion_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unidad_manipulacion_contenidos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    CONSTRAINT "unidad_manipulacion_contenidos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades_manipulacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "unidad_manipulacion_contenidos_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "unidades_manipulacion_empresaId_estado_idx" ON "unidades_manipulacion"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "unidades_manipulacion_zonaAlmacenId_idx" ON "unidades_manipulacion"("zonaAlmacenId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_manipulacion_empresaId_codigo_key" ON "unidades_manipulacion"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_manipulacion_contenidos_unidadId_presentacionId_key" ON "unidad_manipulacion_contenidos"("unidadId", "presentacionId");

