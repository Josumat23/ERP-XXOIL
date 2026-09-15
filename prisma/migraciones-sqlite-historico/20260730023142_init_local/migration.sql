/*
  Warnings:

  - Added the required column `codigo` to the `clientes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `almacenId` to the `movimientos_kardex` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "controles_calidad" ADD COLUMN "accionCorrectiva" TEXT;
ALTER TABLE "controles_calidad" ADD COLUMN "causaRaiz" TEXT;

-- AlterTable
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "monedaOriginal" TEXT;
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "montoOriginal" DECIMAL;
ALTER TABLE "cuentas_por_pagar" ADD COLUMN "tipoCambio" DECIMAL;

-- AlterTable
ALTER TABLE "orden_compra_detalles" ADD COLUMN "fechaEntregaEsperada" DATETIME;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN "fichaTecnicaUrl" TEXT;
ALTER TABLE "productos" ADD COLUMN "hojaSeguridadUrl" TEXT;
ALTER TABLE "productos" ADD COLUMN "segmentoMercado" TEXT;
ALTER TABLE "productos" ADD COLUMN "vidaUtilMeses" INTEGER;

-- CreateTable
CREATE TABLE "escalones_precio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presentacionId" TEXT NOT NULL,
    "cantidadMinima" INTEGER NOT NULL,
    "precio" DECIMAL NOT NULL,
    CONSTRAINT "escalones_precio_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimientos_casco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "movimientos_casco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_casco_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saldos_almacen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "almacenId" TEXT NOT NULL,
    "tipoItem" TEXT NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "cantidad" DECIMAL NOT NULL DEFAULT 0,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "saldos_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "saldos_almacen_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saldos_almacen_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conteos_inventario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "conteo_inventario_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conteoId" TEXT NOT NULL,
    "tipoItem" TEXT NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "cantidadSistema" DECIMAL NOT NULL,
    "cantidadContada" DECIMAL NOT NULL,
    "diferencia" DECIMAL NOT NULL,
    CONSTRAINT "conteo_inventario_detalles_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "conteos_inventario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conteo_inventario_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conteo_inventario_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asignaciones_lote_venta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoDetalleId" TEXT NOT NULL,
    "envasadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'ASIGNADA',
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asignaciones_lote_venta_pedidoDetalleId_fkey" FOREIGN KEY ("pedidoDetalleId") REFERENCES "pedido_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_lote_venta_envasadoId_fkey" FOREIGN KEY ("envasadoId") REFERENCES "envasados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "descuentos_canal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canal" TEXT NOT NULL,
    "descuentoPct" DECIMAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validaHasta" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "total" DECIMAL NOT NULL,
    "notas" TEXT,
    "pedidoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "cotizaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizaciones_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cotizacion_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "cotizacion_detalles_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cotizacion_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recargos_mora" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facturaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diasCalculados" INTEGER NOT NULL,
    "tasaAplicada" DECIMAL NOT NULL,
    "monto" DECIMAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "recargos_mora_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comprobantes_electronicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipoDocumento" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "proveedorOse" TEXT NOT NULL,
    "codigoHash" TEXT,
    "sunatDescripcion" TEXT,
    "enlacePdf" TEXT,
    "enlaceXml" TEXT,
    "enlaceCdr" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntentoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "asignaciones_lote_insumo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteGranelId" TEXT NOT NULL,
    "recepcionCompraDetalleId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asignaciones_lote_insumo_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_lote_insumo_recepcionCompraDetalleId_fkey" FOREIGN KEY ("recepcionCompraDetalleId") REFERENCES "recepcion_compra_detalles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendarios_produccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "almacenId" TEXT NOT NULL,
    "horasLunes" DECIMAL NOT NULL DEFAULT 8,
    "horasMartes" DECIMAL NOT NULL DEFAULT 8,
    "horasMiercoles" DECIMAL NOT NULL DEFAULT 8,
    "horasJueves" DECIMAL NOT NULL DEFAULT 8,
    "horasViernes" DECIMAL NOT NULL DEFAULT 8,
    "horasSabado" DECIMAL NOT NULL DEFAULT 0,
    "horasDomingo" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "calendarios_produccion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dias_no_laborables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarioId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "motivo" TEXT,
    CONSTRAINT "dias_no_laborables_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "calendarios_produccion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "centros_costo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "almacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "centros_costo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "presupuestos_centro_costo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centroCostoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "montoPresupuestado" DECIMAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "presupuestos_centro_costo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reglas_asignacion_costo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "reglas_asignacion_costo_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reglaId" TEXT NOT NULL,
    "centroCostoId" TEXT NOT NULL,
    "porcentaje" DECIMAL NOT NULL,
    CONSTRAINT "reglas_asignacion_costo_detalles_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_asignacion_costo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reglas_asignacion_costo_detalles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "centro_costo_controles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clave" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "reglaId" TEXT,
    CONSTRAINT "centro_costo_controles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "centro_costo_controles_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_asignacion_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activos_fijos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "almacenId" TEXT,
    "fechaAdquisicion" DATETIME NOT NULL,
    "costoAdquisicion" DECIMAL NOT NULL,
    "valorResidual" DECIMAL NOT NULL DEFAULT 0,
    "vidaUtilAnios" INTEGER NOT NULL,
    "depreciacionAcumulada" DECIMAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" DATETIME,
    "motivoBaja" TEXT,
    "precioVenta" DECIMAL,
    "notas" TEXT,
    "centroCostoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activos_fijos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activos_fijos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "depreciaciones_activo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activoFijoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto" DECIMAL NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "depreciaciones_activo_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "activoFijoId" TEXT,
    "centroCostoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipos_activoFijoId_fkey" FOREIGN KEY ("activoFijoId") REFERENCES "activos_fijos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ordenes_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "centroCostoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_mantenimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_mantenimiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "repuestos_orden_mantenimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordenMantenimientoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repuestos_orden_mantenimiento_ordenMantenimientoId_fkey" FOREIGN KEY ("ordenMantenimientoId") REFERENCES "ordenes_mantenimiento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "repuestos_orden_mantenimiento_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "proyecciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "anio" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "anioBase" INTEGER NOT NULL,
    "trimestreBase" INTEGER NOT NULL,
    "crecimientoMercadoPct" DECIMAL NOT NULL DEFAULT 0,
    "factorCompetenciaPct" DECIMAL NOT NULL DEFAULT 0,
    "presupuestoPublicidad" DECIMAL NOT NULL DEFAULT 0,
    "cajaMinimaDeseada" DECIMAL NOT NULL DEFAULT 0,
    "metaUtilidadOperativa" DECIMAL,
    "macroPbiManufacturaVar" DECIMAL,
    "macroInflacionVar" DECIMAL,
    "macroTipoCambio" DECIMAL,
    "macroActualizadoEn" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "proyeccion_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyeccionId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "ventasBase" DECIMAL NOT NULL DEFAULT 0,
    "indiceEstacionalidad" DECIMAL NOT NULL DEFAULT 1,
    "ajusteCualitativoPct" DECIMAL NOT NULL DEFAULT 0,
    "demandaProyectada" DECIMAL NOT NULL DEFAULT 0,
    "precioSimulado" DECIMAL,
    "precioCompetidorRef" DECIMAL,
    CONSTRAINT "proyeccion_detalles_proyeccionId_fkey" FOREIGN KEY ("proyeccionId") REFERENCES "proyecciones" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "proyeccion_detalles_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tipos_cambio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL,
    "valor" DECIMAL NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'BCRP',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "tipoDocumentoIdentidad" TEXT NOT NULL DEFAULT 'DNI',
    "dni" TEXT,
    "nacionalidad" TEXT NOT NULL DEFAULT 'Peruana',
    "fechaNacimiento" DATETIME,
    "fechaIngreso" DATETIME NOT NULL,
    "fechaCese" DATETIME,
    "motivoCese" TEXT,
    "cargo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "tipoContrato" TEXT NOT NULL,
    "sueldoBasico" DECIMAL NOT NULL DEFAULT 0,
    "telefono" TEXT,
    "correo" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "almacenId" TEXT,
    "centroCostoId" TEXT,
    "usuarioId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "empleados_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "empleados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "solicitudes_vacaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "diasSolicitados" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "aprobadaPor" TEXT,
    "aprobadaEn" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "solicitudes_vacaciones_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanioBytes" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tareas_programadas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clave" TEXT NOT NULL,
    "ejecutadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitoso" BOOLEAN NOT NULL,
    "resumen" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'OTRA',
    "pais" TEXT NOT NULL,
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "direccion" TEXT NOT NULL,
    "codigoPostal" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "contactos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "monedaFuncional" TEXT NOT NULL DEFAULT 'PEN',
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_asiento_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asientoId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "glosa" TEXT,
    "debe" DECIMAL NOT NULL DEFAULT 0,
    "haber" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "asiento_detalles_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "asientos_contables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asiento_detalles_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asiento_detalles_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_asiento_detalles" ("asientoId", "cuentaId", "debe", "glosa", "haber", "id") SELECT "asientoId", "cuentaId", "debe", "glosa", "haber", "id" FROM "asiento_detalles";
DROP TABLE "asiento_detalles";
ALTER TABLE "new_asiento_detalles" RENAME TO "asiento_detalles";
CREATE INDEX "asiento_detalles_cuentaId_idx" ON "asiento_detalles"("cuentaId");
CREATE INDEX "asiento_detalles_centroCostoId_idx" ON "asiento_detalles"("centroCostoId");
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "canal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "zonaId" TEXT,
    "vendedorId" TEXT,
    "limiteCredito" DECIMAL NOT NULL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Clientes que ya existían antes de que codigo fuera obligatorio reciben un
-- código correlativo generado (CLI-00001...), igual que siguienteCodigoCliente().
INSERT INTO "new_clientes" ("activo", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "vendedorId", "zonaId")
SELECT "activo", 'CLI-' || substr('00000' || (ROW_NUMBER() OVER (ORDER BY "creadoEn")), -5, 5), "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
CREATE TABLE "new_configuracion_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "razonSocial" TEXT NOT NULL DEFAULT 'Mi Empresa S.A.C.',
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "telefono" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tasaIgv" DECIMAL NOT NULL DEFAULT 18,
    "registroHidrocarburosOsinergmin" TEXT,
    "registroHidrocarburosVigencia" DATETIME,
    "tasaRecargoMora" DECIMAL NOT NULL DEFAULT 0,
    "tarifaHoraManoObra" DECIMAL NOT NULL DEFAULT 0,
    "montoAprobacionCompras" DECIMAL NOT NULL DEFAULT 5000,
    "montoAprobacionPagos" DECIMAL NOT NULL DEFAULT 5000,
    "tasaDescuentoCxC" DECIMAL NOT NULL DEFAULT 9,
    "tasaCreditoCortoPlazo" DECIMAL NOT NULL DEFAULT 9,
    "limiteCreditoCortoPlazo" DECIMAL NOT NULL DEFAULT 100000,
    "tasaCreditoLargoPlazo" DECIMAL NOT NULL DEFAULT 10,
    "oseProveedor" TEXT NOT NULL DEFAULT 'SIMULADO',
    "oseToken" TEXT,
    "actualizadoEn" DATETIME NOT NULL
);
INSERT INTO "new_configuracion_empresa" ("actualizadoEn", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "moneda", "nombreComercial", "pais", "provincia", "razonSocial", "ruc", "sitioWeb", "tarifaHoraManoObra", "tasaIgv", "telefono") SELECT "actualizadoEn", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "moneda", "nombreComercial", "pais", "provincia", "razonSocial", "ruc", "sitioWeb", "tarifaHoraManoObra", "tasaIgv", "telefono" FROM "configuracion_empresa";
DROP TABLE "configuracion_empresa";
ALTER TABLE "new_configuracion_empresa" RENAME TO "configuracion_empresa";
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
    CONSTRAINT "envasados_loteGranelId_fkey" FOREIGN KEY ("loteGranelId") REFERENCES "lotes_granel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "envasados_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_envasados" ("codigo", "costoManoObra", "costoTotal", "costoUnitario", "empresaId", "fecha", "horasManoObra", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "usuarioId", "usuarioNombre") SELECT "codigo", "costoManoObra", "costoTotal", "costoUnitario", "empresaId", "fecha", "horasManoObra", "id", "kgConsumidos", "loteGranelId", "presentacionId", "unidades", "usuarioId", "usuarioNombre" FROM "envasados";
DROP TABLE "envasados";
ALTER TABLE "new_envasados" RENAME TO "envasados";
CREATE UNIQUE INDEX "envasados_codigo_key" ON "envasados"("codigo");
CREATE TABLE "new_insumos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "proveedorId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "esRetornable" BOOLEAN NOT NULL DEFAULT false,
    "montoDeposito" DECIMAL,
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "codigoProveedor" TEXT,
    "zonaAlmacenId" TEXT,
    "notas" TEXT,
    "requiereInspeccion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "insumos_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_insumos" ("activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "id", "moneda", "nombre", "notas", "proveedorId", "requiereInspeccion", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "codigo", "codigoProveedor", "costoUnitario", "creadoEn", "empresaId", "id", "moneda", "nombre", "notas", "proveedorId", "requiereInspeccion", "stock", "stockMinimo", "tipo", "unidadMedida", "zonaAlmacenId" FROM "insumos";
DROP TABLE "insumos";
ALTER TABLE "new_insumos" RENAME TO "insumos";
CREATE UNIQUE INDEX "insumos_empresaId_codigo_key" ON "insumos"("empresaId", "codigo");
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
    "horasManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoManoObra" DECIMAL NOT NULL DEFAULT 0,
    "costoKg" DECIMAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'EN_PROCESO',
    "observaciones" TEXT,
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" DATETIME,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "lotes_granel_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lotes_granel_loteOrigenId_fkey" FOREIGN KEY ("loteOrigenId") REFERENCES "lotes_granel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lotes_granel" ("codigo", "costoInsumos", "costoKg", "costoManoObra", "empresaId", "estado", "fechaFin", "fechaInicio", "formulaId", "horasManoObra", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "mermaKg", "observaciones", "usuarioId", "usuarioNombre") SELECT "codigo", "costoInsumos", "costoKg", "costoManoObra", "empresaId", "estado", "fechaFin", "fechaInicio", "formulaId", "horasManoObra", "id", "kgDisponibles", "kgObjetivo", "kgProducidos", "mermaKg", "observaciones", "usuarioId", "usuarioNombre" FROM "lotes_granel";
DROP TABLE "lotes_granel";
ALTER TABLE "new_lotes_granel" RENAME TO "lotes_granel";
CREATE UNIQUE INDEX "lotes_granel_codigo_key" ON "lotes_granel"("codigo");
CREATE TABLE "new_movimientos_kardex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "almacenId" TEXT NOT NULL,
    "tipoItem" TEXT NOT NULL,
    "presentacionId" TEXT,
    "insumoId" TEXT,
    "tipoMovimiento" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "saldoAnterior" DECIMAL NOT NULL,
    "saldoNuevo" DECIMAL NOT NULL,
    "motivo" TEXT,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimientos_kardex_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_kardex_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "presentaciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "movimientos_kardex_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Movimientos de kardex anteriores a multi-almacén se atribuyen al almacén
-- más antiguo (el que existía antes de que hubiera más de uno).
INSERT INTO "new_movimientos_kardex" ("almacenId", "cantidad", "creadoEn", "empresaId", "fecha", "id", "insumoId", "motivo", "origen", "presentacionId", "referencia", "saldoAnterior", "saldoNuevo", "tipoItem", "tipoMovimiento", "usuarioId", "usuarioNombre")
SELECT (SELECT "id" FROM "almacenes" ORDER BY "creadoEn" ASC LIMIT 1), "cantidad", "creadoEn", "empresaId", "fecha", "id", "insumoId", "motivo", "origen", "presentacionId", "referencia", "saldoAnterior", "saldoNuevo", "tipoItem", "tipoMovimiento", "usuarioId", "usuarioNombre" FROM "movimientos_kardex";
DROP TABLE "movimientos_kardex";
ALTER TABLE "new_movimientos_kardex" RENAME TO "movimientos_kardex";
CREATE INDEX "movimientos_kardex_tipoItem_presentacionId_insumoId_idx" ON "movimientos_kardex"("tipoItem", "presentacionId", "insumoId");
CREATE INDEX "movimientos_kardex_almacenId_tipoItem_presentacionId_insumoId_idx" ON "movimientos_kardex"("almacenId", "tipoItem", "presentacionId", "insumoId");
CREATE TABLE "new_ordenes_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "almacenId" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "total" DECIMAL NOT NULL,
    "notas" TEXT,
    "motivoAnulacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadaPor" TEXT,
    "aprobadaEn" DATETIME,
    "motivoRechazo" TEXT,
    CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ordenes_compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ordenes_compra" ("empresaId", "estado", "fecha", "id", "moneda", "motivoAnulacion", "notas", "numero", "proveedorId", "total", "usuarioId", "usuarioNombre") SELECT "empresaId", "estado", "fecha", "id", "moneda", "motivoAnulacion", "notas", "numero", "proveedorId", "total", "usuarioId", "usuarioNombre" FROM "ordenes_compra";
DROP TABLE "ordenes_compra";
ALTER TABLE "new_ordenes_compra" RENAME TO "ordenes_compra";
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");
CREATE TABLE "new_pagos_proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "cuentaPorPagarId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "medioPago" TEXT NOT NULL,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'NO_REQUERIDA',
    "aprobadoPor" TEXT,
    "aprobadoEn" DATETIME,
    "motivoRechazo" TEXT,
    CONSTRAINT "pagos_proveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_pagos_proveedor" ("cuentaPorPagarId", "empresaId", "fecha", "id", "medioPago", "monto", "referencia", "usuarioId", "usuarioNombre") SELECT "cuentaPorPagarId", "empresaId", "fecha", "id", "medioPago", "monto", "referencia", "usuarioId", "usuarioNombre" FROM "pagos_proveedor";
DROP TABLE "pagos_proveedor";
ALTER TABLE "new_pagos_proveedor" RENAME TO "pagos_proveedor";
CREATE TABLE "new_permisos_grupo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grupoId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "puedeVer" BOOLEAN NOT NULL DEFAULT true,
    "puedeCrear" BOOLEAN NOT NULL DEFAULT false,
    "puedeEditar" BOOLEAN NOT NULL DEFAULT false,
    "puedeAprobar" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "permisos_grupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_seguridad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_permisos_grupo" ("grupoId", "id", "modulo", "puedeCrear", "puedeEditar", "puedeVer") SELECT "grupoId", "id", "modulo", "puedeCrear", "puedeEditar", "puedeVer" FROM "permisos_grupo";
DROP TABLE "permisos_grupo";
ALTER TABLE "new_permisos_grupo" RENAME TO "permisos_grupo";
CREATE UNIQUE INDEX "permisos_grupo_grupoId_modulo_key" ON "permisos_grupo"("grupoId", "modulo");
CREATE TABLE "new_presentaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "productoId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenidoKg" DECIMAL NOT NULL,
    "contenidoLitros" DECIMAL,
    "precio" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "stockReservado" DECIMAL NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL NOT NULL DEFAULT 0,
    "codigoBarras" TEXT,
    "pesoBrutoKg" DECIMAL,
    "unidadesPorCaja" INTEGER,
    "zonaAlmacenId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "presentaciones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "presentaciones_zonaAlmacenId_fkey" FOREIGN KEY ("zonaAlmacenId") REFERENCES "zonas_almacen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_presentaciones" ("activo", "actualizadoEn", "codigoBarras", "contenidoKg", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "unidadesPorCaja", "zonaAlmacenId") SELECT "activo", "actualizadoEn", "codigoBarras", "contenidoKg", "costoPromedio", "creadoEn", "empresaId", "id", "moneda", "nombre", "pesoBrutoKg", "precio", "productoId", "sku", "stock", "stockMinimo", "unidadesPorCaja", "zonaAlmacenId" FROM "presentaciones";
DROP TABLE "presentaciones";
ALTER TABLE "new_presentaciones" RENAME TO "presentaciones";
CREATE UNIQUE INDEX "presentaciones_empresaId_sku_key" ON "presentaciones"("empresaId", "sku");
CREATE TABLE "new_proveedores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "cuentaBancaria" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_proveedores" ("activo", "condicionPagoDias", "contactoNombre", "contactoTelefono", "creadoEn", "cuentaBancaria", "direccion", "email", "empresaId", "id", "notas", "pais", "razonSocial", "ruc", "telefono") SELECT "activo", "condicionPagoDias", "contactoNombre", "contactoTelefono", "creadoEn", "cuentaBancaria", "direccion", "email", "empresaId", "id", "notas", "pais", "razonSocial", "ruc", "telefono" FROM "proveedores";
DROP TABLE "proveedores";
ALTER TABLE "new_proveedores" RENAME TO "proveedores";
CREATE UNIQUE INDEX "proveedores_empresaId_ruc_key" ON "proveedores"("empresaId", "ruc");
CREATE TABLE "new_recepcion_compra_detalles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recepcionId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL,
    "numeroLoteProveedor" TEXT,
    "cantidadDisponible" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "recepcion_compra_detalles_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "recepciones_compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recepcion_compra_detalles_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_recepcion_compra_detalles" ("cantidad", "costoUnitario", "id", "insumoId", "recepcionId") SELECT "cantidad", "costoUnitario", "id", "insumoId", "recepcionId" FROM "recepcion_compra_detalles";
DROP TABLE "recepcion_compra_detalles";
ALTER TABLE "new_recepcion_compra_detalles" RENAME TO "recepcion_compra_detalles";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "escalones_precio_presentacionId_cantidadMinima_key" ON "escalones_precio"("presentacionId", "cantidadMinima");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_almacen_almacenId_tipoItem_presentacionId_insumoId_key" ON "saldos_almacen"("almacenId", "tipoItem", "presentacionId", "insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "conteos_inventario_codigo_key" ON "conteos_inventario"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "descuentos_canal_canal_key" ON "descuentos_canal"("canal");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_numero_key" ON "cotizaciones"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_pedidoId_key" ON "cotizaciones"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_electronicos_empresaId_tipoDocumento_documentoId_key" ON "comprobantes_electronicos"("empresaId", "tipoDocumento", "documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "calendarios_produccion_almacenId_key" ON "calendarios_produccion"("almacenId");

-- CreateIndex
CREATE UNIQUE INDEX "dias_no_laborables_calendarioId_fecha_key" ON "dias_no_laborables"("calendarioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "centros_costo_empresaId_codigo_key" ON "centros_costo"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_centro_costo_centroCostoId_anio_mes_key" ON "presupuestos_centro_costo"("centroCostoId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "reglas_asignacion_costo_detalles_reglaId_centroCostoId_key" ON "reglas_asignacion_costo_detalles"("reglaId", "centroCostoId");

-- CreateIndex
CREATE UNIQUE INDEX "centro_costo_controles_empresaId_clave_key" ON "centro_costo_controles"("empresaId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "activos_fijos_empresaId_codigo_key" ON "activos_fijos"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "depreciaciones_activo_activoFijoId_anio_mes_key" ON "depreciaciones_activo"("activoFijoId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_activoFijoId_key" ON "equipos"("activoFijoId");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_empresaId_codigo_key" ON "equipos"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_mantenimiento_codigo_key" ON "ordenes_mantenimiento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "proyecciones_empresaId_anio_trimestre_key" ON "proyecciones"("empresaId", "anio", "trimestre");

-- CreateIndex
CREATE UNIQUE INDEX "proyeccion_detalles_proyeccionId_presentacionId_key" ON "proyeccion_detalles"("proyeccionId", "presentacionId");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cambio_fecha_key" ON "tipos_cambio"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_usuarioId_key" ON "empleados"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_empresaId_codigo_key" ON "empleados"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_empresaId_dni_key" ON "empleados"("empresaId", "dni");

-- CreateIndex
CREATE INDEX "adjuntos_entidadTipo_entidadId_idx" ON "adjuntos"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "tareas_programadas_clave_ejecutadoEn_idx" ON "tareas_programadas"("clave", "ejecutadoEn");

-- CreateIndex
CREATE INDEX "direcciones_entidadTipo_entidadId_idx" ON "direcciones"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "contactos_entidadTipo_entidadId_idx" ON "contactos"("entidadTipo", "entidadId");
