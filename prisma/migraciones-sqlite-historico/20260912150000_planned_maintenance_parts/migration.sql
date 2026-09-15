-- Repuestos que un plan preventivo PREVE consumir: la lista tecnica
-- planificada, para presupuestar el mantenimiento antes de ejecutarlo.
--
-- Tabla nueva y separada de repuestos_orden_mantenimiento, que registra lo
-- que se consumio de verdad. Prellenar el consumo real desde el plan daria
-- por gastados repuestos que quiza no se usaron, y ese consumo mueve kardex
-- y costo. Nada existente cambia de comportamiento.

CREATE TABLE "repuestos_plan_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planMantenimientoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repuestos_plan_mantenimiento_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "planes_mantenimiento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "repuestos_plan_mantenimiento_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "repuestos_plan_mantenimiento_planMantenimientoId_insumoId_key" ON "repuestos_plan_mantenimiento"("planMantenimientoId", "insumoId");

