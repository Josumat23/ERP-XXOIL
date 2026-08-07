# 02 — Catálogo de procesos L0-L4 de una fabricante de lubricantes

**Metodología**: L0 = empresa. L1 = cadena de valor (Order-to-Cash, Procure-to-Pay, Plan-to-Produce, etc., nomenclatura estándar de referencia SAP/APQC). L2 = subproceso. L3 = paso de proceso, mapeado a una pantalla/estado real del sistema. L4 = actividad/transacción concreta, mapeada a una función de servidor (`actions.ts`) o a un cálculo (`src/lib/*.ts`) con evidencia de archivo:línea cuando aplica. Donde un nivel L3/L4 estándar de un fabricante de lubricantes **no existe** en el repositorio, se marca explícitamente `[GAP]` — esto alimenta directamente la matriz fit/gap (Blueprint 04).

---

## L0 — XXOil (fabricante y distribuidora de grasas y lubricantes)

## L1.1 — Order to Cash (O2C) — Ventas

| L2 | L3 (pantalla/estado real) | L4 (acción/cálculo, evidencia) |
|---|---|---|
| Gestión de la demanda comercial | Cotización → probabilidad de cierre | `crearCotizacion`, `actualizarProbabilidad` (`comercial/cotizaciones/actions.ts`) |
| | Embudo de ventas | Lectura agregada por probabilidad (`comercial/pipeline`) |
| Toma de pedido | Conversión cotización→pedido | `convertirCotizacionAPedido` |
| | Pedido directo | `crearPedido` — reserva stock (`Presentacion.stockReservado`, `prisma/schema.prisma:234`) |
| | Verificación de crédito | Validación de `Cliente.limiteCredito` **al facturar**, no al tomar el pedido `[GAP parcial — ver Blueprint 03 §7: SAP valida crédito en la toma de pedido (VKM1/VKM3), no solo al facturar]` |
| | Chequeo de disponibilidad (ATP) | `/comercial/atp` — stock envasado + granel aprobado + lotes en proceso, de solo lectura, no bloqueante en la creación del pedido `[GAP parcial — no es un chequeo ATP en línea con reserva automática, es un reporte de apoyo]` |
| Despacho | Guía de remisión electrónica | `crearGuiaRemision`, `enviarComprobanteGuia`, `marcarSalidaGuia`, `marcarEntregaGuia` |
| | Picking/oleadas de almacén | `[GAP — ver Blueprint 04, dominio EWM]` no existe orden de picking, HU, ni oleada |
| Facturación | Facturación electrónica SUNAT | `facturarPedido` → `enviarComprobanteFactura` (adaptador Nubefact/OSE o SUNAT directo, `src/lib/facturacionElectronica.ts`) |
| | Nota de crédito / débito | `crearNotaCredito` (crédito con líneas reales); **nota de débito no existe** `[GAP]` |
| | Devolución física | `registrarDevolucion` |
| Cobro | Registro de cobro | `registrarCobro` |
| | Gestión de cobranza / dunning | `registrarAvisoCobranza` (3 niveles), `alternarBloqueoCliente` |
| | Recargo por mora | `aplicarRecargoMora` (tarea programada) |
| Comisiones | Cálculo y reversión de comisión | Generada al facturar, revertida en NC/anulación (`model Comision`, `TipoComision.GENERADA/REVERSION`) |
| Reclamos posventa | Reclamo de cliente | `crearReclamo`, `actualizarEstadoReclamo`, causa vinculada a `CausaCalidad` |

## L1.2 — Procure to Pay (P2P) — Compras

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Planificación de necesidades | MRP simple | `/logistica/mrp`, cruza `Proyeccion` contra `FormulaDetalle` |
| Solicitud/orden de compra | Creación de OC | `crearOrdenCompra` |
| | Aprobación por monto | `aprobarOrdenCompra`/`rechazarOrdenCompra`, umbral único global (`ConfiguracionEmpresa.montoAprobacionCompras`) `[GAP parcial — sin esquema de liberación multi-nivel por organización de compras/monto escalonado]` |
| | Cotización a varios proveedores (RFQ) | `[GAP]` — no existe comparación formal de cotizaciones de proveedores en el sistema (confirmado por síntesis de gobernanza, `docs/gobernanza/02-cruce-rf/MM.md`) |
| Recepción | Recepción de mercadería | `registrarRecepcion` — actualiza kardex y costo promedio ponderado |
| | Inspección de calidad de entrada | `resolverInspeccionCompra` (bloqueante: stock no disponible hasta aprobar) |
| | Devolución a proveedor | `registrarDevolucionProveedor` |
| Verificación de factura | Verificación en 3 vías | `CuentaPorPagar.discrepanciaPrecioPct` (OC↔recepción↔factura, tolerancia 5%, `prisma/schema.prisma:1489-1494`) — informativo, no bloqueante |
| Pago | Pago individual | `registrarPagoProveedor` + aprobación por monto |
| | Propuesta de pago en lote | `ejecutarPropuestaPago` |

## L1.3 — Plan to Produce (fabricación de proceso — PP-PI)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Receta maestra | Fórmula versionada | `crearFormula` (una vigente por producto, historial nunca editado) |
| Orden de proceso | Lote granel (cocción) | `crearLote` — descuenta insumos por fórmula, `finalizarLote` registra merma y costo |
| | Ruteo / centro de trabajo con tiempos | `[GAP]` — no existe operación/fase con tiempo estándar por centro de trabajo; el lote es una sola transacción sin ruteo |
| | Trazabilidad de materia prima hacia el lote | `AsignacionLoteInsumo` (lote de proveedor → lote granel) |
| Control de calidad en proceso | Aprobación/rechazo de lote | `registrarCalidad`, `ControlCalidad.resultado` |
| | No conformidad y causa raíz | `CausaCalidad`, `accionCorrectiva` |
| | Reproceso | `LoteGranel.loteOrigenId` (trazabilidad, sin transferencia automática de costo) |
| Envasado (etapa 2) | Conversión granel→presentación | `crearEnvasado` — consume granel + envases/etiquetas, calcula costo unitario |
| | Trazabilidad de venta hacia el lote de envasado | `AsignacionLoteVenta` (para recall) |
| Planificación de capacidad | Calendario de producción por almacén | `CalendarioProduccion` + `DiaNoLaborable`, horas por día de semana |
| | Nivelación de capacidad / centro de trabajo | `[GAP]` — confirmado por síntesis de gobernanza (`docs/gobernanza/02-cruce-rf/PP.md`): "no hay 'puestos de trabajo' con tiempos de mecanizado" |

## L1.4 — Warehouse to Deliver (gestión de almacén y transporte)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Estructura de almacén | Almacén / zona | `Almacen`, `ZonaAlmacen` (una zona por ítem, sin partición de cantidad por bin) |
| Movimientos | Traslado entre almacenes / reubicación de zona | `crearTraslado`, `reubicarZona` — **metadata-only, no genera `MovimientoKardex`** para reubicación de zona (`docs/gobernanza/010-AI/inventario-reubicacion-zonas/RN.md`, RN-REUB-003) |
| Conteo físico | Conteo cíclico | `crearConteo` (auto-ajusta diferencias) |
| Picking/despacho estructurado | Orden de picking, oleada, unidad de manejo (HU) | `[GAP]` — confirmado `docs/gobernanza/02-cruce-rf/WM-EWM.md`: 92/98 RF de EWM descartados por "sobre-ingeniería" a la escala evaluada entonces |
| Transporte | Guía de remisión + vínculo a equipo de flota propia | `GuiaRemision.equipoId`, `EstadoDespacho` (PLANIFICADO/EN_RUTA/ENTREGADO) |
| | Gestión de transportistas terceros / licitación de flete | `[GAP]` — descartado en `docs/gobernanza/02-cruce-rf/TM.md` bajo supuesto de flota propia únicamente |

## L1.5 — Record to Report (contabilidad y controlling)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Contabilización automática | Asiento por venta/cobro/compra/pago/NC/anulación | `OrigenAsiento` enum (17 orígenes, `prisma/schema.prisma:1859-1878`), mapa transacción→cuenta vía `ControlContable` |
| | Asiento manual | `crearAsientoManual` (debe=haber obligatorio, período abierto) |
| | Corrección | `reversarAsiento` (nunca edición directa) |
| Cierre de período | Calendario fiscal | `PeriodoFiscal.estado` (ABIERTO/CERRADO), bloquea contabilización |
| | Cierre formal multi-paso (checklist, reconciliación) | `[GAP]` — el cierre es binario (abierto/cerrado), sin lista de tareas de cierre ni conciliaciones automáticas |
| Controlling | Centro de costo, presupuesto, prorrateo | `CentroCosto`, `PresupuestoCentroCosto`, `ReglaAsignacionCosto` |
| | Jerarquía de centros de costo | `[GAP]` — `CentroCosto` es plano, sin `parentId` (confirmado Blueprint 03 §6) |
| | Orden interna | `OrdenInterna` (ciclo abierta→liquidada/anulada) |
| | Rentabilidad (CO-PA reducido) | `/finanzas/rentabilidad` por segmento de mercado y canal |
| Reporte financiero | Balance de comprobación, estado de resultados, situación financiera | Lectura directa del mayor, con comparación de períodos |
| Activos fijos | Alta, depreciación mensual, baja, venta | `crearActivoFijo`, `registrarDepreciacionMes` (tarea programada), `darDeBajaActivoFijo`, `venderActivoFijo` |
| Cumplimiento tributario | PLE (Registro de Compras/Ventas) | `/finanzas/libros-electronicos` — ver Blueprint 07 para vigencia frente a SIRE |

## L1.6 — Acquire to Retire (activos y mantenimiento)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Alta de activo | Registro + vínculo opcional a `Equipo` | `crearActivoFijo`, relación 1:1 `ActivoFijo.equipo` |
| Mantenimiento | Plan preventivo (por tiempo o por contador) | `PlanMantenimiento`, `crearPlanMantenimiento` |
| | Orden de mantenimiento (preventivo/correctivo) | `crearOrdenMantenimiento`, `iniciarOrdenMantenimiento`, `completarOrdenMantenimiento` (descuenta repuestos reales), `cancelarOrdenMantenimiento` |
| | Bloqueo de capacidad por mantenimiento programado | `OrdenMantenimiento` en estado `PROGRAMADA` bloquea días en `CalendarioProduccion` (`prisma/schema.prisma:2339-2341`) |
| | Jerarquía de ubicación técnica | `[GAP]` — no existe estructura equipo→sub-equipo ni ubicación técnica multinivel |
| Baja/venta | Baja o venta con utilidad/pérdida contable | `darDeBajaActivoFijo`, `venderActivoFijo` |

## L1.7 — Project to Capitalize (obras de capital propio)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Estructura del proyecto | EDT/WBS jerárquico | `EdtProyecto` (`@relation("EdtJerarquia")`, real, con `parentId`) |
| Red de actividades | Actividad + precedencia | `crearActividad`, `crearPrecedencia` (solo Fin-a-Inicio, validación de ciclos por DFS) |
| Ruta crítica | Cálculo CPM | `recalcularRutaCritica()` en `src/lib/proyectos.ts` — `esCritica`, `holguraDias` |
| | Nivelación de recursos | `[GAP]` — `responsableId` es solo informativo, sin chequeo de sobre-asignación (`docs/gobernanza/010-AI/proyectos/RN.md`, RN-PRY-002) |
| | Calendario de días hábiles del proyecto | `[GAP]` — ruta crítica en días calendario, no días laborables (RN-PRY-003) |
| Costeo | Costo real acumulado (ledger + OC no anuladas) | `agregarCostoProyecto`, cálculo siempre en vivo (RN-PRY-005) |
| | Aprobación de presupuesto por fase | `[GAP]` — sin workflow de aprobación por fase (RN-PRY exclusiones documentadas) |
| Cierre | Capitalización como activo fijo | `ActivoFijo.proyectoId` — capitalizar es independiente de cerrar el proyecto (RN-PRY-008) |

## L1.8 — Hire to Retire (RR.HH.)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Ficha de personal | Alta/baja de empleado | `crearEmpleado`, `darDeBajaEmpleado` |
| | Estructura organizativa (organigrama, jefe→reporte) | `[GAP]` — `cargo`/`área` son texto libre, sin jerarquía (Blueprint 03 §8) |
| Ausencias | Vacaciones | `solicitarVacaciones` → `aprobarVacaciones`/`rechazarVacaciones`, saldo calculado al vuelo (30 días/año ley peruana) |
| Nómina | Planilla mensual con aportes legales | `crearPlanillaMensual` — EsSalud, ONP/AFP, retención 5ta categoría (ver Blueprint 07 para vigencia de tasas) |
| | Gratificación jul/dic, CTS may/nov | `crearGratificacion`, `crearCts` (vía `PlanillaPeriodo.tipo`) |
| | Liquidación por cese | `LiquidacionDesvinculacion` |
| Autoservicio (ESS/MSS) | Portal de empleado | `[GAP]` — descartado explícitamente en `docs/gobernanza/02-cruce-rf/HCM.md` bajo supuesto de plantilla reducida |
| Reclutamiento / desarrollo | Selección, capacitación, evaluación de desempeño | `[GAP]` — no modelado |

## L1.9 — Plan (S&OP / planeamiento)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Plan de demanda | Estacionalidad desde historia + supuestos cualitativos | `Proyeccion`, `ProyeccionDetalle` — estacionalidad calculada de ventas reales |
| Plan de operaciones | Necesidades de insumos según fórmulas | Alimenta `/logistica/mrp` |
| Plan financiero | P&L proyectado, caja mínima, cascada de financiamiento | `actualizarCajaMinima`, tasas en `ConfiguracionEmpresa` (CxC→corto plazo→largo plazo) |
| Simulación de precios | Meta de utilidad operativa | `guardarSimulacionPrecios` |
| Planeamiento colaborativo multi-área con aprobación formal | Workflow de consenso S&OP | `[GAP]` — es edición directa por pestaña, sin ciclo de aprobación entre Marketing/Operaciones/Finanzas |

## L1.10 — Quality Management (transversal, ya cubierto por L1.3, se referencia aparte por su naturaleza cross-proceso)

Cubre entrada (inspección de compra), proceso (control de calidad de lote) y posventa (reclamo de cliente) con un catálogo de causas compartido (`CausaCalidad`). **No cubierto**: certificados de análisis con valores medidos por parámetro (`ControlCalidad` es aprobado/rechazado, no captura mediciones — `docs/gobernanza/05-disparadores-fase3-diferida.md` §13), control estadístico de proceso (SPC).

## L1.11 — Governance, Risk & Compliance (transversal)

| L2 | L3 | L4 (evidencia) |
|---|---|---|
| Segregación de funciones | Grupos de seguridad con permisos por módulo | `GrupoSeguridad`, `PermisoGrupo` (ver/crear/editar/aprobar separados) |
| Revisión de accesos | Alerta de inactividad 90 días | `docs/gobernanza/010-AI/configuracion-usuarios/RN.md` |
| Pista de auditoría | usuario/fecha/motivo en cada registro | Patrón consistente en >15 modelos (nunca se edita/borra historia) |
| Gestión formal de riesgos, SoD con motor de conflictos, certificación de accesos | `[GAP]` — descartado en `docs/gobernanza/02-cruce-rf/GRC.md` (46/49 RF) bajo supuesto de organización pequeña; **candidato prioritario de re-examen** para escala grande |

## L1.12 — Business Intelligence (transversal)

Hub de reportes (`/reportes`) + comparación de períodos en reportes financieros clave. Sin data warehouse, sin modelo dimensional, sin planificación colaborativa tipo SAC — descartado en `docs/gobernanza/02-cruce-rf/BI.md` por volumen de datos transaccional bajo en el momento en que se escribió (candidato de re-examen a escala grande, ver Blueprint 04).

---

## Resumen de `[GAP]` marcados en este catálogo (input directo a Blueprint 04)

1. Verificación de crédito en la toma de pedido (no solo al facturar).
2. ATP en línea con reserva automática (hoy es reporte de apoyo).
3. Picking/oleadas/HU de almacén — ausente.
4. Nota de débito — ausente (solo nota de crédito).
5. RFQ / comparación formal de cotizaciones de proveedores.
6. Esquema de liberación de compras multi-nivel por organización.
7. Ruteo/centro de trabajo con tiempos estándar en producción.
8. Nivelación de capacidad de producción por centro de trabajo.
9. Gestión de transportistas terceros / licitación de flete.
10. Cierre contable formal multi-paso (checklist/conciliaciones).
11. Jerarquía de centros de costo.
12. Jerarquía de ubicación técnica de mantenimiento.
13. Nivelación de recursos y calendario de días hábiles en Proyectos.
14. Aprobación de presupuesto por fase en Proyectos.
15. Estructura organizativa jerárquica de RR.HH. (organigrama).
16. Autoservicio de empleado (ESS/MSS).
17. Reclutamiento y desarrollo de personal.
18. Workflow de consenso formal en S&OP.
19. Certificados de análisis con valores medidos / SPC.
20. Motor de SoD, gestión de riesgos y certificación de accesos (GRC formal).
21. Data warehouse / modelo dimensional para BI.

Cada uno de estos se retoma en Blueprint 04 con aplicabilidad, riesgo y prioridad específicos para la escala objetivo (fabricante grande, varias plantas).
