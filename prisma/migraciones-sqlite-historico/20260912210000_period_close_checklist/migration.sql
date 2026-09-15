-- Checklist de cierre de periodo: verificaciones automaticas derivadas de los
-- propios datos del periodo, mas tareas propias con orden y dependencia.
--
-- El sistema NO trae una lista de tareas predefinida: que incluye un cierre
-- contable es criterio del contador y este codigo no lo inventa. Lo que aporta
-- es el mecanismo.
--
-- Aditivo: el periodo sigue siendo abierto/cerrado y cerrar sigue siendo
-- decision del contador. pendientesAlCerrar solo deja constancia.

ALTER TABLE "periodos_fiscales" ADD COLUMN "pendientesAlCerrar" INTEGER;

-- CreateTable
CREATE TABLE "tareas_cierre_periodo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodoFiscalId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "completadaEn" DATETIME,
    "completadaPorId" TEXT,
    "completadaPorNombre" TEXT,
    "nota" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tareas_cierre_periodo_periodoFiscalId_fkey" FOREIGN KEY ("periodoFiscalId") REFERENCES "periodos_fiscales" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tareas_cierre_periodo_periodoFiscalId_orden_key" ON "tareas_cierre_periodo"("periodoFiscalId", "orden");

