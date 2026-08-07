# 01 — Inventario exacto de dominios, módulos, submódulos, páginas, entidades, acciones y reportes

**Fuente**: lectura directa de `src/lib/navegacion.ts` (fuente única de la agrupación/etiquetas del menú lateral, consumida por `src/components/Sidebar.tsx`), cada `page.tsx` bajo `src/app/(app)/`, cada `actions.ts` (nombres de función `export async function`), y `prisma/schema.prisma` completo (2888 líneas). Fecha de corte: 2026-08-06.

**Clasificación de pantalla**: **PROCESO** = flujo multi-paso con estados/aprobaciones · **DATO MAESTRO** = catálogo CRUD simple · **REPORTE** = solo lectura, derivado/calculado · **TRANSACCIÓN** = un solo paso pero escribe un registro de historia inmutable (no es CRUD de catálogo ni proceso multi-estado).

---

## A. Dominios y módulos (agrupación real del menú)

| Dominio (menú) | Submódulos | # pantallas |
|---|---|---|
| Ventas (`comercial/*`) | — | 13 |
| Materiales | Inventario (`catalogo/*`, `inventario/*`), Compras (`logistica/*`, `catalogo/proveedores*`) | 10 + 6 |
| Producción (`produccion/*`) | — | 10 |
| Finanzas | Tesorería, Contabilidad, Reportes | 5 + 9 + 4 |
| Proyectos (`proyectos`) | — | 1 |
| Recursos Humanos (`rrhh/*`) | — | 5 |
| Configuración del Sistema (`configuracion/*`) | — | 10 |
| Sin agrupar (`titulo: null`) | Panel general, Reportes hub, Proyecciones | 3 |

Total: **~86 rutas funcionales** bajo `src/app/(app)/` (130 archivos `page.tsx` contando variantes `[id]`/`nuevo`).

---

## B. Ventas (`comercial/*`)

| Ruta | Etiqueta | Propósito (evidencia de `actions.ts`) | Tipo |
|---|---|---|---|
| `comercial/cotizaciones` (+`[id]`,`/nuevo`) | Cotizaciones | `crearCotizacion`, `actualizarProbabilidad`, `marcarCotizacion` (ACEPTADA/RECHAZADA), `convertirCotizacionAPedido` | **PROCESO** |
| `comercial/pipeline` | Embudo de ventas | Solo lectura — funnel por probabilidad, valor ponderado | **REPORTE** |
| `comercial/pedidos` (+`[id]`,`/nuevo`) | Pedidos | `crearPedido` (reserva stock), `anularPedido`, `facturarPedido` | **PROCESO** |
| `comercial/facturas` (+`[id]`) | Facturas | `enviarComprobanteFactura`, `registrarCobro`, `crearNotaCredito`, `anularFactura`, `registrarDevolucion`, `aplicarRecargoMora` | **PROCESO** |
| `comercial/hojas-ruta` (+`[id]`,`/nueva`) | Hojas de ruta | `crearHojaRuta`, `cerrarHojaRuta` | **PROCESO** (ligero) |
| `comercial/comisiones` | Comisiones | Solo lectura, ledger inmutable generado al facturar | **REPORTE / ledger** |
| `comercial/clientes` (+`[id]`,`/nuevo`) | Clientes | `crearCliente`, `actualizarCliente`, `alternarActivoCliente` | **DATO MAESTRO** |
| `comercial/descuentos-canal` | Descuento por canal | `guardarDescuentoCanal` | **DATO MAESTRO** |
| `comercial/cascos` | Cascos pendientes | `registrarMovimientoCasco` | **TRANSACCIÓN / ledger** |
| `comercial/backlog` | Backlog de pedidos | Solo lectura | **REPORTE** |
| `comercial/atp` | ATP — Disponible para prometer | Solo lectura | **REPORTE** |
| `comercial/vendedores` (+`[id]`,`/nuevo`) | Vendedores | `crearVendedor`, `actualizarVendedor`, `alternarActivoVendedor` | **DATO MAESTRO** |
| `comercial/zonas` (+`[id]`) | Zonas | `crearZona`, `actualizarZona`, `alternarActivoZona` | **DATO MAESTRO** |

---

## C. Materiales → Inventario (`catalogo/*`, `inventario/*`)

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `catalogo/productos` (+`[id]`,`/nuevo`) | Productos | `crearProducto`, `actualizarProducto`, `alternarActivoProducto` | **DATO MAESTRO** |
| `catalogo/presentaciones` (+`[id]`,`/nuevo`) | Presentaciones | `crearPresentacion`, `crearEscalonPrecio`, `alternarActivoPresentacion` | **DATO MAESTRO** |
| `catalogo/insumos` (+`[id]`,`/nuevo`) | Insumos | `crearInsumo`, `actualizarInsumo`, `alternarActivoInsumo` | **DATO MAESTRO** |
| `catalogo/categorias` (+`[id]`) | Categorías | `crearCategoria`, `actualizarCategoria` | **DATO MAESTRO** |
| `inventario/kardex` | Kardex | Solo lectura, append-only | **REPORTE** |
| `inventario/ajustes` | Ajustes | `crearAjuste` | **TRANSACCIÓN** |
| `inventario/traslados` | Traslados entre almacenes | `crearTraslado`, `reubicarZona` | **TRANSACCIÓN** |
| `inventario/conteos` (+`[id]`) | Conteo cíclico | `crearConteo` (auto-ajusta) | **PROCESO ligero** |
| `inventario/rotacion-abc` | Rotación y ABC | Solo lectura | **REPORTE** |
| `inventario/exactitud` | Exactitud de inventario | Solo lectura | **REPORTE** |

## D. Materiales → Compras (`logistica/*`, `catalogo/proveedores*`)

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `logistica/mrp` | MRP — Necesidades de compra | Solo lectura (planificación) | **REPORTE / planning** |
| `logistica/ordenes-compra` (+`[id]`,`/nuevo`) | Órdenes de compra | `crearOrdenCompra`, `aprobarOrdenCompra`, `rechazarOrdenCompra`, `registrarRecepcion`, `registrarDevolucionProveedor`, `anularOrdenCompra` | **PROCESO** |
| `logistica/inspeccion-compras` (+`[id]`) | Inspección de calidad | `resolverInspeccionCompra` | **PROCESO (paso)** |
| `logistica/guias-remision` (+`[id]`,`/nueva`) | Guías de remisión | `crearGuiaRemision`, `marcarSalidaGuia`, `marcarEntregaGuia`, `enviarComprobanteGuia` | **PROCESO** |
| `catalogo/proveedores` (+`[id]`,`/nuevo`) | Proveedores | `crearProveedor`, `actualizarProveedor`, `alternarActivoProveedor` | **DATO MAESTRO** |
| `catalogo/proveedores/evaluacion` | Evaluación de proveedores | Solo lectura | **REPORTE** |

---

## E. Producción (`produccion/*`)

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `produccion/formulas` (+`[id]`,`/nueva`) | Fórmulas | `crearFormula`, `alternarActivoFormula` (versionadas, nunca se editan) | **DATO MAESTRO (versionado)** |
| `produccion/lotes` (+`[id]`,`/nuevo`) | Órdenes de producción | `crearLote`, `finalizarLote` | **PROCESO** |
| `produccion/calidad` | Control de calidad | `registrarCalidad` | **PROCESO (paso)** |
| `produccion/calidad/causas` | Causas de calidad | `crearCausaCalidad` | **DATO MAESTRO** |
| `produccion/calidad/reclamos` (+`[id]`) | Reclamos de cliente | `crearReclamo`, `actualizarEstadoReclamo` | **PROCESO** |
| `produccion/envasados` (+`[id]`,`/nuevo`) | Envasados | `crearEnvasado` | **PROCESO (paso)** |
| `produccion/lotes/recall` | Trazabilidad / recall | Solo lectura | **REPORTE** |
| `produccion/equipos` (+`[id]`,`/nuevo`) | Equipos | `crearEquipo`, `actualizarContadorEquipo`, `crearPlanMantenimiento` | **DATO MAESTRO** |
| `produccion/mantenimiento` (+`[id]`,`/nuevo`) | Mantenimiento | `crearOrdenMantenimiento`, `iniciarOrdenMantenimiento`, `completarOrdenMantenimiento`, `cancelarOrdenMantenimiento` | **PROCESO** |

---

## F. Finanzas → Tesorería

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `finanzas/cuentas-por-cobrar` | Cuentas por cobrar | Solo lectura | **REPORTE** |
| `finanzas/cuentas-por-pagar` (+`[id]`) | Cuentas por pagar | `registrarPagoProveedor`, `aprobarPagoProveedor`, `rechazarPagoProveedor` | **PROCESO** |
| `finanzas/cobranza` | Gestión de cobranza | `registrarAvisoCobranza`, `alternarBloqueoCliente` | **PROCESO (dunning)** |
| `finanzas/propuesta-pago` | Propuesta de pago | `ejecutarPropuestaPago` | **PROCESO (batch)** |
| `finanzas/caja` | Libro de caja | `crearMovimientoCaja` | **TRANSACCIÓN / ledger** |

## G. Finanzas → Contabilidad

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `finanzas/asientos` (+`[id]`,`/nuevo`) | Asientos contables | `crearAsientoManual`, `reversarAsiento` | **TRANSACCIÓN (reverso-only)** |
| `finanzas/balance` | Balance de comprobación | Solo lectura | **REPORTE** |
| `finanzas/plan-cuentas` | Plan de cuentas | `crearCuentaContable`, `asignarControlContable` | **DATO MAESTRO** |
| `finanzas/centros-costo` (+`[id]`,`/nuevo`) | Centros de costo | `crearCentroCosto`, `guardarPresupuesto`, `guardarAsignacionControl` | **DATO MAESTRO + presupuesto** |
| `finanzas/centros-costo/reglas` (+`/nueva`) | Reglas y asignación | `crearReglaAsignacion`, `alternarActivoRegla` | **DATO MAESTRO** |
| `finanzas/centros-costo/reclasificaciones` | Reclasificación de costos | `reclasificarCosto` | **PROCESO** |
| `finanzas/ordenes-internas` (+`[id]`,`/nueva`) | Órdenes internas | `crearOrdenInterna`, `agregarCostoOrdenInterna`, `liquidarOrdenInterna`, `anularOrdenInterna` | **PROCESO (ciclo de vida)** |
| `finanzas/activos-fijos` (+`[id]`,`/nuevo`) | Activos fijos | `crearActivoFijo`, `registrarDepreciacionMes`, `darDeBajaActivoFijo`, `venderActivoFijo` | **PROCESO (ciclo de vida)** |
| `finanzas/libros-electronicos` | Libros electrónicos (PLE) | Genera PLE 14.1/8.1 SUNAT | **PROCESO / export legal** |

## H. Finanzas → Reportes

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `finanzas/costos` | Costos y márgenes | Solo lectura | **REPORTE** |
| `finanzas/rentabilidad` | Rentabilidad por segmento/canal | Solo lectura | **REPORTE** |
| `finanzas/resultados` | Estado de resultados | Solo lectura, con comparación de períodos | **REPORTE** |
| `finanzas/situacion-financiera` | Situación financiera | Solo lectura, balance clasificado | **REPORTE** |

---

## I. Proyectos

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `proyectos` (+`[id]`,`/nuevo`) | Proyectos de inversión | `crearProyecto`, `cambiarEstadoProyecto`, `crearEdt`, `crearActividad`/`eliminarActividad`, `crearPrecedencia`/`eliminarPrecedencia`, `agregarCostoProyecto` | **PROCESO** (WBS + CPM real, `src/lib/proyectos.ts`) |

---

## J. Recursos Humanos (`rrhh/*`)

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `rrhh/empleados` (+`[id]`,`/nuevo`) | Empleados | `crearEmpleado`, `darDeBajaEmpleado`, `solicitarVacaciones`, `aprobarVacaciones`, `rechazarVacaciones` | **DATO MAESTRO + proceso embebido** |
| `rrhh/vacaciones` | Solicitudes de vacaciones | Bandeja central de aprobación | **PROCESO** |
| `rrhh/headcount` | Headcount por área | Solo lectura | **REPORTE** |
| `rrhh/planilla` (+`[id]`,`[id]/[detalleId]`,`/parametros`) | Planilla | `crearPlanillaMensual`, `crearGratificacion`, `crearCts` | **PROCESO** |
| `rrhh/planilla/parametros` | Parámetros de planilla | `crearParametroPlanilla`, `crearTasaAfp` (versionado por fecha de vigencia) | **DATO MAESTRO (versionado)** |

---

## K. Configuración del sistema (`configuracion/*`)

| Ruta | Etiqueta | Propósito |
|---|---|---|
| `configuracion/empresa` | Empresa | `guardarConfiguracionEmpresa`, `agregarCuentaBancaria` |
| `configuracion/empresas` | Compañías (multi-empresa) | `crearEmpresa`, `cambiarEmpresaActiva`, `alternarActivaEmpresa` — ver Blueprint 03 para el alcance real |
| `configuracion/usuarios` | Usuarios | `crearUsuario`, `restablecerPassword`, `asignarGrupoUsuario`, `alternarActivoUsuario` |
| `configuracion/series` | Series de documentos | `crearSerieDocumento`, `alternarActivoSerie` |
| `configuracion/almacenes` | Almacenes y zonas | `crearAlmacen`, `crearZonaAlmacen`, `guardarHorasCalendario`, `agregarDiaNoLaborable`, `cargarFeriadosPeru` |
| `configuracion/unidades-medida` | Unidades de medida | `crearClaseUnidadMedida`, `crearUnidadMedida` |
| `configuracion/grupos-seguridad` | Grupos de seguridad | `crearGrupoSeguridad`, `actualizarPermiso` |
| `configuracion/calendario-fiscal` | Calendario fiscal | `generarAnioFiscal`, `alternarPeriodoFiscal` |
| `configuracion/monitoreo` | Monitoreo | Métricas de servidor en vivo (WebSocket, 2s) | **REPORTE / panel operativo** |
| `configuracion/tareas-programadas` | Tareas programadas | `ejecutarTareaAhora` | **Panel de control de jobs automáticos** |

---

## L. Sin agrupar

| Ruta | Etiqueta | Propósito | Tipo |
|---|---|---|---|
| `/` | Panel general | Dashboard ejecutivo | **REPORTE** |
| `/reportes` | Reportes | Hub de navegación a todos los reportes | **Navegación** |
| `/proyecciones` (+`[id]`) | Proyecciones | `obtenerOCrearProyeccion`, `actualizarSupuestosMarketing`, `actualizarCajaMinima`, `actualizarDetalleProyeccion`, `guardarSimulacionPrecios`, `refrescarFactorMacro` | **PROCESO (S&OP)** |

---

## M. Widgets embebidos (sin `page.tsx`, sin entrada de menú)

- `src/app/(app)/adjuntos/actions.ts` — DMS reducido (`subirAdjunto`, `eliminarAdjunto`), asociación polimórfica `entidadTipo`/`entidadId` (sin FK real, `prisma/schema.prisma:2761-2776`).
- `src/app/(app)/contactos/actions.ts` — contactos (`agregarContacto`, `eliminarContacto`), mismo patrón polimórfico (`prisma/schema.prisma:2848-2861`).
- `src/app/(app)/direcciones/actions.ts` — direcciones (`agregarDireccion`, `eliminarDireccion`), mismo patrón (`prisma/schema.prisma:2830-2846`).

---

## N. Entidades (modelos Prisma) — inventario completo por dominio

Fuente: `prisma/schema.prisma`, archivo completo (2888 líneas), lectura íntegra. Se listan todos los `model` declarados; los `enum` se omiten de esta tabla por volumen pero están documentados por referencia en Blueprint 05 donde son relevantes para un campo específico.

### Configuración / sistema
`ConfiguracionEmpresa`, `CuentaBancariaEmpresa`, `Empresa`, `Usuario`, `Sesion`, `GrupoSeguridad`, `PermisoGrupo`, `SerieDocumento`, `Almacen`, `CalendarioProduccion`, `DiaNoLaborable`, `ZonaAlmacen`, `ClaseUnidadMedida`, `UnidadMedida`, `PeriodoFiscal`, `TareaProgramada`, `Adjunto`, `Direccion`, `Contacto`.

### Catálogo / maestros de producto
`Categoria`, `Producto`, `Presentacion`, `EscalonPrecio`, `Proveedor`, `Insumo`.

### Inventario
`MovimientoKardex`, `SaldoAlmacen`, `ConteoInventario`, `ConteoInventarioDetalle`, `MovimientoCasco`.

### Producción / calidad
`Formula`, `FormulaDetalle`, `LoteGranel`, `ControlCalidad`, `CausaCalidad`, `ReclamoCliente`, `Envasado`, `AsignacionLoteVenta`, `EnvasadoInsumo`, `AsignacionLoteInsumo`.

### Mantenimiento / activos
`Equipo`, `PlanMantenimiento`, `OrdenMantenimiento`, `RepuestoOrdenMantenimiento`, `ActivoFijo`, `DepreciacionActivo`.

### Comercial / ventas
`Zona`, `Vendedor`, `DescuentoCanal`, `Cliente`, `Cotizacion`, `CotizacionDetalle`, `Pedido`, `PedidoDetalle`, `Factura`, `RecargoMora`, `AvisoCobranza`, `ComprobanteElectronico`, `Cobro`, `NotaCredito`, `NotaCreditoDetalle`, `Comision`, `HojaRuta`, `HojaRutaVisita`.

### Logística / compras
`OrdenCompra`, `OrdenCompraDetalle`, `RecepcionCompra`, `RecepcionCompraDetalle`, `DevolucionCompra`, `InspeccionCompra`, `GuiaRemision`, `Ubigeo`, `GuiaRemisionDetalle`.

### Finanzas / tesorería
`CuentaPorPagar`, `PagoProveedor`, `MovimientoCaja`.

### Contabilidad
`PlanCuentas`, `CuentaContable`, `Libro`, `AsientoContable`, `AsientoDetalle`, `ControlContable`.

### Controlling
`CentroCosto`, `PresupuestoCentroCosto`, `OrdenInterna`, `OrdenInternaCosto`, `ReglaAsignacionCosto`, `ReglaAsignacionCostoDetalle`, `CentroCostoControl`.

### Proyectos
`Proyecto`, `EdtProyecto`, `ActividadProyecto`, `PrecedenciaActividad`, `CostoProyecto`.

### Planeamiento
`Proyeccion`, `ProyeccionDetalle`, `TipoCambio`.

### RR.HH.
`Empleado`, `SolicitudVacaciones`, `ParametroPlanilla`, `TasaAfp`, `PlanillaPeriodo`, `PlanillaDetalle`, `LiquidacionDesvinculacion`.

**Total de modelos**: **83 modelos** de negocio (sin contar `enum`).

**Nota de estilo de diseño consistente en todo el esquema** (evidencia: comentarios repetidos en >15 modelos, ej. `prisma/schema.prisma:5-7`, `466-469`, `701-705`): la historia nunca se edita ni se borra — kardex, facturas, cobros, comisiones, asientos, depreciaciones y asignaciones de lote se compensan con movimientos nuevos, nunca sobrescritos. Este es un principio de auditoría consistente que **facilita** varios de los requisitos de trazabilidad de un fabricante grande (ver Blueprint 04, dominio QM/GRC).

---

## O. Reportes (inventario consolidado, solo lectura)

Pipeline, Backlog, ATP, Comisiones (ledger), Evaluación de proveedores, MRP (vista de sugerencias), Kardex, Rotación-ABC, Exactitud de inventario, Costos y márgenes, Rentabilidad por segmento/canal, Estado de resultados, Situación financiera, Balance de comprobación, Cuentas por cobrar, Headcount por área, Trazabilidad/recall, Monitoreo (panel operativo), Panel general, Reportes (hub de navegación). **19 pantallas de solo lectura.**
