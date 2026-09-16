-- Quita el valor por omisión "1" de empresaId en los 94 modelos que lo tenían.
--
-- El default venía del arranque mono-empresa. Hoy hace algo peor que no servir:
-- una escritura que se olvida de la compañía no falla, archiva la fila en la
-- compañía 1 y no avisa. Eso es una fuga silenciosa entre empresas — el tipo de
-- defecto que solo se descubre cuando alguien de otra compañía ve datos ajenos.
--
-- Sin el default, Prisma marca empresaId como obligatorio y el olvido pasa a ser
-- un error de compilación. No cambia ni un dato: solo deja de rellenar por
-- nosotros. Reversible con ALTER COLUMN ... SET DEFAULT '1'.

-- AlterTable
ALTER TABLE "activos_fijos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "acuerdos_suministro" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "adjuntos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "almacenes" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "aplicaciones_credito_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "aplicaciones_credito_proveedor" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asientos_contables" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asignaciones_posicion" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "auditoria_maestros" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "avisos_cobranza" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "avisos_mantenimiento" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "campanas_certificacion_accesos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categorias" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "causas_calidad" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "centro_costo_controles" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "centros_costo" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "centros_trabajo" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clases_unidad_medida" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cobros" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "comisiones" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "comprobantes_electronicos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conciliaciones_bancarias" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "configuracion_empresa" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contactos_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conteos_inventario" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "controles_contables" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cotizaciones" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "creditos_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "creditos_proveedor" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cuentas_bancarias_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cuentas_bancarias_empresa" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cuentas_por_pagar" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "descuentos_canal" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "devoluciones_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "devoluciones_compra" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "direcciones_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "empleados" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "envasados" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "equipos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "facturas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "formulas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "grupos_seguridad" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "guias_remision" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hojas_ruta" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "incidencias_contables" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "insumos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "libros" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "licitaciones_flete" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lotes_granel" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "movimientos_caja" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "movimientos_casco" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "movimientos_kardex" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "niveles_aprobacion_compra" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "no_conformidades_calidad" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notas_credito" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notas_debito" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "oleadas_picking" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ordenes_compra" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ordenes_internas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ordenes_mantenimiento" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pagos_proveedor" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "parametros_planilla" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pedidos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "periodos_fiscales" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planes_cuentas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planes_inspeccion_calidad" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planes_inspeccion_insumo" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planes_mantenimiento" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planilla_periodos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "politicas_tiempo_trabajo" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "posiciones_organizativas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "presentaciones" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "productos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "proveedores" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "proyecciones" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "proyectos" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reanalisis_envasado" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recepciones_compra" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reclamos_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reembolsos_cliente" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reembolsos_proveedor" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "registros_asistencia" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rfq_compras" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "series_documento" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "solicitudes_cambio_credito" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tanques" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transportistas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "turnos_trabajo" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ubicaciones_tecnicas" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "unidades_manipulacion" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vendedores" ALTER COLUMN "empresaId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "zonas" ALTER COLUMN "empresaId" DROP DEFAULT;
