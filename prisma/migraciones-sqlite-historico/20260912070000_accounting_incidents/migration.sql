-- Transaccion operativa que no llego a generar su asiento contable.
-- postearAsiento() es best-effort a proposito: la operacion comercial no se
-- revierte cuando falta un control contable, el periodo esta cerrado o el
-- presupuesto se excede. Lo que faltaba era el rastro: el fallo no dejaba
-- ninguno y la transaccion quedaba sin asiento en silencio.
-- Tabla aditiva: nada existente cambia de comportamiento al aplicarla.

CREATE TABLE "incidencias_contables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "origen" TEXT NOT NULL,
    "glosa" TEXT NOT NULL,
    "referencia" TEXT,
    "motivo" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "resueltoEn" DATETIME,
    "resueltoPorId" TEXT,
    "resueltoPorNombre" TEXT,
    "notaResolucion" TEXT,
    CONSTRAINT "incidencias_contables_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "incidencias_contables_empresaId_resueltoEn_fecha_idx" ON "incidencias_contables"("empresaId", "resueltoEn", "fecha");

