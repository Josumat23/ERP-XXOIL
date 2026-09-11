-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_causas_calidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "causas_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_causas_calidad" ("activo", "creadoEn", "empresaId", "id", "nombre") SELECT "activo", "creadoEn", "empresaId", "id", "nombre" FROM "causas_calidad";
DROP TABLE "causas_calidad";
ALTER TABLE "new_causas_calidad" RENAME TO "causas_calidad";
CREATE UNIQUE INDEX "causas_calidad_empresaId_nombre_key" ON "causas_calidad"("empresaId", "nombre");
CREATE TABLE "new_envasados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "loteGranelId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "unidadesDisponibles" INTEGER NOT NULL DEFAULT 0,
    "kgConsumidos" DECIMAL NOT NULL,
    "horasManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoTotal" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "envasados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "envasados_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "envasados_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_envasados" ("codigo", "costoManoObra", "costoTotal", "costoUnitario", "empresaId", "fecha", "fechaVencimiento", "horasManoObra", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "unidadesDisponibles", "usuarioId", "usuarioNombre") SELECT "codigo", "costoManoObra", "costoTotal", "costoUnitario", "empresaId", "fecha", "fechaVencimiento", "horasManoObra", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "unidadesDisponibles", "usuarioId", "usuarioNombre" FROM "envasados";
DROP TABLE "envasados";
ALTER TABLE "new_envasados" RENAME TO "envasados";
CREATE UNIQUE INDEX "envasados_codigo_key" ON "envasados"("codigo");
CREATE TABLE "new_formulas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rendimientoKg" DECIMAL NOT NULL,
    "horasEstandar" DECIMAL,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" DATETIME,
    "vigenteHasta" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "formulas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "formulas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_formulas" ("activo", "creadoEn", "empresaId", "horasEstandar", "id", "notas", "productoId", "rendimientoKg", "usuarioId", "usuarioNombre", "version", "vigenteDesde", "vigenteHasta") SELECT "activo", "creadoEn", "empresaId", "horasEstandar", "id", "notas", "productoId", "rendimientoKg", "usuarioId", "usuarioNombre", "version", "vigenteDesde", "vigenteHasta" FROM "formulas";
DROP TABLE "formulas";
ALTER TABLE "new_formulas" RENAME TO "formulas";
CREATE UNIQUE INDEX "formulas_productoId_version_key" ON "formulas"("productoId", "version");
CREATE TABLE "new_lotes_granel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "loteOrigenId" TEXT,
    "kgObjetivo" DECIMAL NOT NULL,
    "kgProducidos" DECIMAL NOT NULL DEFAULT 0,
    "mermaKg" DECIMAL NOT NULL DEFAULT 0,
    "kgDisponibles" DECIMAL NOT NULL DEFAULT 0,
    "costoInsumos" DECIMAL NOT NULL DEFAULT 0,
    "costoReproceso" DECIMAL NOT NULL DEFAULT 0,
    "horasManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoKg" DECIMAL NOT NULL DEFAULT 0,
    "costoEstandarInsumos" DECIMAL,
    "costoEstandarManoObra" DECIMAL,
    "costoEstandarTotal" DECIMAL,
    "costoEstandarPermitido" DECIMAL,
    "variacionInsumos" DECIMAL,
    "variacionManoObra" DECIMAL,
    "variacionRendimiento" DECIMAL,
    "variacionTotal" DECIMAL,
    "estado" TEXT NOT NULL DEFAULT 'EN_PROCESO',
    "observaciones" TEXT,
    "fechaCreacion" DATETIME,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLiberacion" DATETIME,
    "usuarioLiberacionId" TEXT,
    "usuarioLiberacionNombre" TEXT,
    "fechaCancelacion" DATETIME,
    "motivoCancelacion" TEXT,
    "usuarioCancelacionId" TEXT,
    "usuarioCancelacionNombre" TEXT,
    "fechaFin" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "disposicionRechazo" TEXT,
    "motivoDisposicion" TEXT,
    "fechaDisposicion" DATETIME,
    "usuarioDisposicionId" TEXT,
    "usuarioDisposicionNombre" TEXT,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "lotes_granel_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lotes_granel_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lotes_granel_loteOrigenId_fkey" FOREIGN KEY ("loteOrigenId") REFERENCES "lotes_granel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lotes_granel" ("codigo", "costoEstandarInsumos", "costoEstandarManoObra", "costoEstandarPermitido", "costoEstandarTotal", "costoInsumos", "costoKg", "costoManoObra", "costoReproceso", "disposicionRechazo", "empresaId", "estado", "fechaCancelacion", "fechaCreacion", "fechaDisposicion", "fechaFin", "fechaInicio", "fechaLiberacion", "formulaId", "horasManoObra", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "loteOrigenId", "mermaKg", "motivoCancelacion", "motivoDisposicion", "observaciones", "usuarioCancelacionId", "usuarioCancelacionNombre", "usuarioDisposicionId", "usuarioDisposicionNombre", "usuarioId", "usuarioLiberacionId", "usuarioLiberacionNombre", "usuarioNombre", "variacionInsumos", "variacionManoObra", "variacionRendimiento", "variacionTotal") SELECT "codigo", "costoEstandarInsumos", "costoEstandarManoObra", "costoEstandarPermitido", "costoEstandarTotal", "costoInsumos", "costoKg", "costoManoObra", "costoReproceso", "disposicionRechazo", "empresaId", "estado", "fechaCancelacion", "fechaCreacion", "fechaDisposicion", "fechaFin", "fechaInicio", "fechaLiberacion", "formulaId", "horasManoObra", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "loteOrigenId", "mermaKg", "motivoCancelacion", "motivoDisposicion", "observaciones", "usuarioCancelacionId", "usuarioCancelacionNombre", "usuarioDisposicionId", "usuarioDisposicionNombre", "usuarioId", "usuarioLiberacionId", "usuarioLiberacionNombre", "usuarioNombre", "variacionInsumos", "variacionManoObra", "variacionRendimiento", "variacionTotal" FROM "lotes_granel";
DROP TABLE "lotes_granel";
ALTER TABLE "new_lotes_granel" RENAME TO "lotes_granel";
CREATE UNIQUE INDEX "lotes_granel_codigo_key" ON "lotes_granel"("codigo");
CREATE TABLE "new_no_conformidades_calidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "controlCalidadId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "contencionInmediata" TEXT,
    "causaRaizConfirmada" TEXT,
    "accionCorrectiva" TEXT,
    "responsableId" TEXT,
    "responsableNombre" TEXT,
    "fechaCompromiso" DATETIME,
    "verificacionEficacia" TEXT,
    "eficaz" BOOLEAN,
    "cerradoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "no_conformidades_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "no_conformidades_calidad_controlCalidadId_fkey" FOREIGN KEY ("controlCalidadId") REFERENCES "controles_calidad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_no_conformidades_calidad" ("accionCorrectiva", "actualizadoEn", "causaRaizConfirmada", "cerradoEn", "contencionInmediata", "controlCalidadId", "creadoEn", "eficaz", "empresaId", "estado", "fechaCompromiso", "id", "responsableId", "responsableNombre", "verificacionEficacia") SELECT "accionCorrectiva", "actualizadoEn", "causaRaizConfirmada", "cerradoEn", "contencionInmediata", "controlCalidadId", "creadoEn", "eficaz", "empresaId", "estado", "fechaCompromiso", "id", "responsableId", "responsableNombre", "verificacionEficacia" FROM "no_conformidades_calidad";
DROP TABLE "no_conformidades_calidad";
ALTER TABLE "new_no_conformidades_calidad" RENAME TO "no_conformidades_calidad";
CREATE UNIQUE INDEX "no_conformidades_calidad_controlCalidadId_key" ON "no_conformidades_calidad"("controlCalidadId");
CREATE INDEX "no_conformidades_calidad_empresaId_estado_fechaCompromiso_idx" ON "no_conformidades_calidad"("empresaId", "estado", "fechaCompromiso");
CREATE TABLE "new_planes_inspeccion_calidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "vigenteDesde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planes_inspeccion_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "planes_inspeccion_calidad_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_planes_inspeccion_calidad" ("activo", "creadoEn", "empresaId", "id", "nombre", "productoId", "usuarioId", "usuarioNombre", "version", "vigenteDesde", "vigenteHasta") SELECT "activo", "creadoEn", "empresaId", "id", "nombre", "productoId", "usuarioId", "usuarioNombre", "version", "vigenteDesde", "vigenteHasta" FROM "planes_inspeccion_calidad";
DROP TABLE "planes_inspeccion_calidad";
ALTER TABLE "new_planes_inspeccion_calidad" RENAME TO "planes_inspeccion_calidad";
CREATE INDEX "planes_inspeccion_calidad_empresaId_activo_idx" ON "planes_inspeccion_calidad"("empresaId", "activo");
CREATE UNIQUE INDEX "planes_inspeccion_calidad_productoId_version_key" ON "planes_inspeccion_calidad"("productoId", "version");
CREATE TABLE "new_reclamos_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT,
    "causaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "accionCorrectiva" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "reclamos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reclamos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reclamos_cliente_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reclamos_cliente_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "causas_calidad" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_reclamos_cliente" ("accionCorrectiva", "actualizadoEn", "causaId", "clienteId", "creadoEn", "descripcion", "empresaId", "estado", "facturaId", "fecha", "fechaCierre", "id", "numero", "usuarioId", "usuarioNombre") SELECT "accionCorrectiva", "actualizadoEn", "causaId", "clienteId", "creadoEn", "descripcion", "empresaId", "estado", "facturaId", "fecha", "fechaCierre", "id", "numero", "usuarioId", "usuarioNombre" FROM "reclamos_cliente";
DROP TABLE "reclamos_cliente";
ALTER TABLE "new_reclamos_cliente" RENAME TO "reclamos_cliente";
CREATE UNIQUE INDEX "reclamos_cliente_numero_key" ON "reclamos_cliente"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
