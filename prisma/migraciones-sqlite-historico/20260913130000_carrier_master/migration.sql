-- Maestro de transportistas contratados.
--
-- La distribucion no es 100% flota propia: el negocio confirmo el 2026-09-13
-- que tiene flota, terceriza y ademas contrata para despacho. Hasta ahora cada
-- guia capturaba razon social, RUC, placa y DNI sueltos, retipeados en cada
-- emision.
--
-- Los campos de texto de la guia NO se borran: guardan lo que se imprimio y
-- son el respaldo de las guias que el relleno no logre emparejar. Es el mismo
-- criterio que se uso con el ubigeo y la direccion escrita a mano.


-- CreateTable
CREATE TABLE "transportistas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "registroMtc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transportistas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transportista_vehiculos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transportistaId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "transportista_vehiculos_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transportista_conductores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transportistaId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "licencia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "transportista_conductores_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guias_remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT,
    "pedidoId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fechaTraslado" DATETIME NOT NULL,
    "puntoPartida" TEXT NOT NULL,
    "puntoLlegada" TEXT NOT NULL,
    "ubigeoPartidaId" TEXT,
    "ubigeoLlegadaId" TEXT,
    "motivoTraslado" TEXT NOT NULL DEFAULT 'Venta',
    "pesoBrutoTotal" DECIMAL NOT NULL DEFAULT 0,
    "modalidadTransporte" TEXT NOT NULL DEFAULT 'PRIVADO',
    "transportistaId" TEXT,
    "transportista" TEXT,
    "transportistaRuc" TEXT,
    "placaVehiculo" TEXT,
    "dniConductor" TEXT,
    "observaciones" TEXT,
    "equipoId" TEXT,
    "estadoDespacho" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "fechaSalida" DATETIME,
    "fechaEntrega" DATETIME,
    "anuladaEn" DATETIME,
    "anuladaPorId" TEXT,
    "anuladaPorNombre" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guias_remision_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoPartidaId_fkey" FOREIGN KEY ("ubigeoPartidaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "guias_remision_ubigeoLlegadaId_fkey" FOREIGN KEY ("ubigeoLlegadaId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_guias_remision" ("anuladaEn", "anuladaPorId", "anuladaPorNombre", "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "modalidadTransporte", "motivoAnulacion", "motivoTraslado", "numero", "observaciones", "pedidoId", "pesoBrutoTotal", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "transportistaRuc", "ubigeoLlegadaId", "ubigeoPartidaId", "usuarioId", "usuarioNombre") SELECT "anuladaEn", "anuladaPorId", "anuladaPorNombre", "clienteId", "creadoEn", "dniConductor", "empresaId", "equipoId", "estadoDespacho", "facturaId", "fechaEntrega", "fechaSalida", "fechaTraslado", "id", "modalidadTransporte", "motivoAnulacion", "motivoTraslado", "numero", "observaciones", "pedidoId", "pesoBrutoTotal", "placaVehiculo", "puntoLlegada", "puntoPartida", "transportista", "transportistaRuc", "ubigeoLlegadaId", "ubigeoPartidaId", "usuarioId", "usuarioNombre" FROM "guias_remision";
DROP TABLE "guias_remision";
ALTER TABLE "new_guias_remision" RENAME TO "guias_remision";
CREATE INDEX "guias_remision_pedidoId_idx" ON "guias_remision"("pedidoId");
CREATE UNIQUE INDEX "guias_remision_empresaId_numero_key" ON "guias_remision"("empresaId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "transportistas_empresaId_codigo_key" ON "transportistas"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "transportistas_empresaId_ruc_key" ON "transportistas"("empresaId", "ruc");

-- CreateIndex
CREATE UNIQUE INDEX "transportista_vehiculos_transportistaId_placa_key" ON "transportista_vehiculos"("transportistaId", "placa");

-- CreateIndex
CREATE UNIQUE INDEX "transportista_conductores_transportistaId_dni_key" ON "transportista_conductores"("transportistaId", "dni");


-- ---------------------------------------------------------------------------
-- Relleno desde las guias ya emitidas.
--
-- Solo se deduce lo que el dato REALMENTE dice. Un RUC y una placa son hechos
-- que estan en la guia; el nombre del conductor no esta en ninguna parte (solo
-- su DNI), asi que los conductores NO se rellenan: inventarles un nombre
-- ensuciaria el maestro. Se registran a mano la proxima vez que se use uno.
--
-- Una guia sin RUC de transportista se queda como esta: es transporte propio,
-- o un dato que nunca se capturo. Preferible dejarla sin emparejar que
-- asignarle un transportista equivocado.
-- ---------------------------------------------------------------------------

INSERT INTO "transportistas" ("id", "empresaId", "codigo", "razonSocial", "ruc", "activo", "creadoEn")
SELECT
  'transp-' || g."empresaId" || '-' || g."transportistaRuc",
  g."empresaId",
  'TRA-' || substr('00000' || CAST(ROW_NUMBER() OVER (PARTITION BY g."empresaId" ORDER BY g."transportistaRuc") AS TEXT), -5),
  -- Si ninguna guia registro la razon social, el RUC es el unico nombre que
  -- hay. Queda visible y se corrige en pantalla.
  COALESCE(MAX(g."transportista"), g."transportistaRuc"),
  g."transportistaRuc",
  true,
  CURRENT_TIMESTAMP
FROM "guias_remision" g
WHERE g."transportistaRuc" IS NOT NULL AND TRIM(g."transportistaRuc") <> ''
GROUP BY g."empresaId", g."transportistaRuc";

UPDATE "guias_remision"
SET "transportistaId" = (
  SELECT t."id" FROM "transportistas" t
  WHERE t."empresaId" = "guias_remision"."empresaId"
    AND t."ruc" = "guias_remision"."transportistaRuc"
)
WHERE "transportistaRuc" IS NOT NULL AND TRIM("transportistaRuc") <> '';

-- Las placas que ya viajaron con ese transportista.
INSERT INTO "transportista_vehiculos" ("id", "transportistaId", "placa", "activo")
SELECT DISTINCT
  'veh-' || g."transportistaId" || '-' || g."placaVehiculo",
  g."transportistaId",
  g."placaVehiculo",
  true
FROM "guias_remision" g
WHERE g."transportistaId" IS NOT NULL
  AND g."placaVehiculo" IS NOT NULL
  AND TRIM(g."placaVehiculo") <> '';
