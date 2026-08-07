# 06 — Matriz de integración end-to-end

**Metodología**: para cada cadena documental relevante (Venta, Compra, Producción, Activo fijo, Proyecto, Planilla) se traza qué toca cada paso en **inventario**, **calidad**, **costo**, **contabilidad** y **auditoría**, citando el modelo/campo/enum exacto de `prisma/schema.prisma` y la función de `actions.ts` que lo dispara. El objetivo es exponer dónde la integración es real (un solo evento dispara todo lo necesario de forma consistente) y dónde es best-effort o inexistente.

---

## Cadena 1 — Venta (Order to Cash)

**Documento origen**: `Cotizacion` (opcional) → `Pedido` → `Factura` → `Cobro`/`NotaCredito`.

| Paso | Inventario | Calidad | Costo | Contabilidad | Auditoría |
|---|---|---|---|---|---|
| `crearPedido` | `Presentacion.stockReservado` aumenta (reserva, no consume) — `prisma/schema.prisma:234` | — | `PedidoDetalle.costoUnitario` queda en 0 hasta facturar | — | `usuarioId`/`usuarioNombre` en `Pedido` |
| `facturarPedido` → `enviarComprobanteFactura` | `MovimientoKardex` (`OrigenMovimiento.VENTA`), `SaldoAlmacen` baja, `AsignacionLoteVenta` (`TipoAsignacionLote.ASIGNADA`) vincula la venta al lote de envasado específico | Indirecta — solo puede venderse stock que ya pasó por `ControlCalidad.APROBADO` en su origen (el envasado consumió granel aprobado) | `PedidoDetalle.costoUnitario` = snapshot del costo promedio ponderado al momento de facturar (`prisma/schema.prisma:939`) | `AsientoContable` con `origen: VENTA` (`prisma/schema.prisma:1861`), vía `ControlContable` (claves `VENTAS`, `IGV_POR_PAGAR`, `COSTO_VENTAS`, `INVENTARIO_PT`) | `usuarioId`/`usuarioNombre` en `Factura`; comprobante electrónico con `ComprobanteElectronico.intentos`/`ultimoIntentoEn` como bitácora de envío a SUNAT |
| `registrarCobro` | — | — | — | `AsientoContable` origen `COBRO` | `Cobro.usuarioId` |
| `crearNotaCredito` | `AsignacionLoteVenta` (`TipoAsignacionLote.LIBERADA`) — libera la trazabilidad de lote proporcional a lo acreditado | — | `NotaCreditoDetalle` referencia el `PedidoDetalle` real (no un monto suelto — corregido explícitamente, ver `000-Governance/010-AI/sunat-facturacion-electronica/SQL.md`) | `AsientoContable` origen `NOTA_CREDITO`, reversión de comisión (`Comision.tipo = REVERSION`) | `motivo` obligatorio, `usuarioId` |
| `anularFactura` | Libera stock reservado/asignado según corresponda | — | — | `AsientoContable` origen `ANULACION_VENTA` | `motivoAnulacion`, `anuladaEn`, `anuladaPor` en `Factura` |
| Recargo por mora / cobranza | — | — | — | Incrementa `Factura.saldo`, sin afectar `Factura.total` (el valor de venta emitido en SUNAT no se toca — `prisma/schema.prisma:999-1003`) | `RecargoMora.usuarioId`, `AvisoCobranza` con nivel y snapshot de días vencidos |

**Integración verificada como real (un solo evento, efecto consistente)**: facturar un pedido es la única función que simultáneamente mueve kardex, congela costo, genera comisión, contabiliza y dispara el envío electrónico — confirmado por la firma de `facturarPedido`/`enviarComprobanteFactura` en `comercial/facturas/actions.ts` y por el patrón "best-effort" documentado (`prisma/schema.prisma:1062-1063`): *si el envío a SUNAT o el asiento contable fallan, el documento comercial ya está creado y la operación no se bloquea* — es decir, la integración contable/fiscal es best-effort, no transaccionalmente atómica con la venta en sí. Esto se retoma en Blueprint 08 (auditoría no funcional) como hallazgo de integridad.

**Trazabilidad hacia atrás confirmada**: desde una `Factura`, vía `PedidoDetalle` → `AsignacionLoteVenta` → `Envasado` → `LoteGranel` → `AsignacionLoteInsumo` → `RecepcionCompraDetalle.numeroLoteProveedor`, el sistema puede responder "¿de qué lote de proveedor viene lo que le vendimos a este cliente?" — cadena de trazabilidad completa verificada por relación de modelos, no solo por diseño intencional (`produccion/lotes/recall`, confirmado como pantalla real en Blueprint 01).

**Desconexión verificada entre Ventas y Compras/Producción (planificación)**: `Pedido.crearPedido` reserva stock real (`Presentacion.stockReservado`, fila de arriba), pero esa reserva **no se propaga a la planificación de compras/producción** — `calcularOperaciones()` (`src/lib/proyecciones.ts:182`, el motor detrás de `/logistica/mrp`) calcula necesidad de producción usando `Presentacion.stock` sin restar `stockReservado`, a diferencia de `/comercial/atp` que sí lo hace para el mismo campo (`comercial/atp/page.tsx:19`). En otras palabras: **el pedido de un cliente real reserva stock para la venta, pero no informa correctamente cuánto hay que producir/comprar** — el MRP se guía solo por el pronóstico trimestral (`Proyeccion`), nunca por el backlog real de pedidos pendientes. Detalle completo y solución propuesta en Blueprint 04 (sección MRP) y Blueprint 09 (ítem 0.1b).

---

## Cadena 2 — Compra (Procure to Pay)

**Documento origen**: `OrdenCompra` → `RecepcionCompra` → `CuentaPorPagar` → `PagoProveedor`.

| Paso | Inventario | Calidad | Costo | Contabilidad | Auditoría |
|---|---|---|---|---|---|
| `crearOrdenCompra` | — | — | `OrdenCompraDetalle.costoUnitario` (pactado) | — | `estadoAprobacion`, `aprobadaPor`, `aprobadaEn` |
| `registrarRecepcion` | `MovimientoKardex` (`OrigenMovimiento.COMPRA`), `SaldoAlmacen` sube — **salvo que el insumo tenga `requiereInspeccion = true`**, en cuyo caso el stock no cuenta como disponible hasta `InspeccionCompra.resultado = APROBADO` | `InspeccionCompra` bloqueante — confirmado: la cantidad recibida no suma stock ni recalcula costo hasta la aprobación (`prisma/schema.prisma:1344-1347`) | `Insumo.costoUnitario` se **recalcula como promedio ponderado en cada recepción** (no al pagar) | `AsientoContable` origen `COMPRA` | `RecepcionCompra.usuarioId`, `numeroLoteProveedor` por línea para trazabilidad |
| Generación automática de CxP | — | — | `CuentaPorPagar.discrepanciaPrecioPct` — verificación de 3 vías (OC↔recepción↔lo que se paga), tolerancia 5%, informativo | `CuentaPorPagar` nace directamente de la recepción, sin paso manual | — |
| `registrarDevolucionProveedor` | Reduce stock físico | Motivo de no conformidad detectada post-recepción | `DevolucionCompra.montoCredito` = cantidad × costoUnitario de la línea, aplicado como crédito a la CxP | — | `motivo`, `usuarioId` |
| `registrarPagoProveedor` | — | — | — | `AsientoContable` origen `PAGO_PROVEEDOR` | `estadoAprobacion`, `aprobadoPor` (segregación: quien pide el pago ≠ quien lo aprueba) |

**Integración verificada como real**: la recepción es el único evento que mueve kardex, recalcula costo y genera la CxP — sin intervención manual entre esos tres efectos. La verificación de 3 vías es real como **señal**, no como bloqueo (`prisma/schema.prisma:1493`: *"no bloquea el pago — solo lo señala"*), lo cual es una decisión de diseño deliberada, no un descuido, pero vale la pena reconsiderar a mayor volumen de compra (ver Blueprint 04, MM).

---

## Cadena 3 — Producción (Plan to Produce)

**Documento origen**: `Formula` → `LoteGranel` → `ControlCalidad` → `Envasado`.

| Paso | Inventario | Calidad | Costo | Contabilidad | Auditoría |
|---|---|---|---|---|---|
| `crearLote` | `MovimientoKardex` (`OrigenMovimiento.PRODUCCION`) descuenta insumos según `FormulaDetalle`; `AsignacionLoteInsumo` traza qué lote de proveedor se consumió | — | `LoteGranel.costoInsumos` (consumo real), `costoManoObra` = horas × `ConfiguracionEmpresa.tarifaHoraManoObra` | — (el costo de producción no genera asiento por sí solo hasta el envasado/venta) | `usuarioId`, `fechaInicio`/`fechaFin` |
| `finalizarLote` | `LoteGranel.mermaKg` = kgObjetivo − kgProducidos | — | `costoKg` = (costoInsumos + costoManoObra) / kgProducidos — **la merma encarece el kg** (mecanismo de costeo real, no teórico) | — | — |
| `registrarCalidad` | Bloquea envasado si `RECHAZADO` | `ControlCalidad.resultado`, `causaId` (catálogo estructurado `CausaCalidad`), `accionCorrectiva` | — | — | `usuarioId`, `fecha` |
| `crearEnvasado` | `MovimientoKardex` (`OrigenMovimiento.ENVASADO`) — consume granel + envases/etiquetas, `Envasado.unidadesDisponibles` sube | Solo puede envasarse granel `APROBADO` | `Envasado.costoTotal` = granel consumido + envases/etiquetas + mano de obra; `costoUnitario` actualiza `Presentacion.costoPromedio` | — | `usuarioId`, `fechaVencimiento` calculada de `Producto.vidaUtilMeses` |

**Hallazgo de integración**: el costo de producción **no contabiliza automáticamente en el momento de producir** — solo se refleja en el mayor cuando ese stock se vende (vía `PedidoDetalle.costoUnitario` congelado y la cuenta `COSTO_VENTAS`). Esto es coherente con un sistema de costeo por absorción simple (el costo "vive" en el inventario hasta la venta), pero **no hay una cuenta de "producción en proceso" (WIP) que se mueva contablemente entre el lote granel y el envasado** — confirmado por ausencia de un `OrigenAsiento` dedicado a producción en el enum (`prisma/schema.prisma:1859-1878`: no existe `PRODUCCION` ni `ENVASADO` como origen de asiento, solo como origen de movimiento de kardex). Es una integración de **inventario real, contabilidad diferida al punto de venta** — válido para el modelo de negocio actual, pero merece confirmarse como decisión consciente a mayor escala (Blueprint 10).

---

## Cadena 4 — Activo fijo (Acquire to Retire)

| Paso | Inventario | Costo | Contabilidad | Auditoría |
|---|---|---|---|---|
| `crearActivoFijo` | Puede originarse en la capitalización de un `Proyecto` (`ActivoFijo.proyectoId`) | `costoAdquisicion`, `valorResidual`, `vidaUtilAnios` | — | `usuarioId` |
| `registrarDepreciacionMes` (tarea programada) | — | `depreciacionAcumulada` acumula, nunca se edita a mano | `AsientoContable` origen `DEPRECIACION`, `DepreciacionActivo` es ledger inmutable con `@@unique([activoFijoId, anio, mes])` — imposible cargar el mismo mes dos veces | `TareaProgramada` con `clave: DEPRECIACION_MENSUAL`, bitácora de éxito/fallo |
| `venderActivoFijo` | — | `precioVenta` vs. valor en libros | `AsientoContable` origen `VENTA_ACTIVO_FIJO` (utilidad/pérdida contable real) | `fechaBaja`, `motivoBaja` |

**Integración verificada como real y con buena disciplina de auditoría**: el `@@unique` a nivel de base de datos previene doble depreciación del mismo mes — un control de integridad real, no solo aplicativo.

---

## Cadena 5 — Proyecto de inversión (Project to Capitalize)

| Paso | Costo | Contabilidad | Auditoría |
|---|---|---|---|
| `agregarCostoProyecto` | `CostoProyecto.monto`, opcionalmente por `edtId` | — (el costo del proyecto es informativo/WIP, no se postea como gasto de período — `prisma/schema.prisma:2186-2188`) | `usuarioId` |
| `OrdenCompra.proyectoId`/`edtId` | Compras etiquetadas al proyecto se suman al costo real | — | — |
| Capitalización | `ActivoFijo.proyectoId` enlaza el activo resultante | `AsientoContable` origen `ORDEN_INTERNA` **no aplica aquí** — la capitalización de Proyecto usa el flujo normal de `crearActivoFijo`, sin un origen de asiento propio para "capitalización de proyecto" en el enum | `RN-PRY-008`: capitalizar es independiente de cerrar el proyecto |

**Hallazgo de integración**: el costo real de un proyecto se calcula **siempre en vivo** (suma de `CostoProyecto` + OC no anuladas etiquetadas), nunca como un campo persistido que pueda desincronizarse — confirmado por `docs/gobernanza/010-AI/proyectos/RN.md`, RN-PRY-005. Esto es una fortaleza de integridad, aunque tiene costo de rendimiento a verificar con muchos proyectos/costos acumulados (ver Blueprint 08).

---

## Cadena 6 — Planilla (Hire to Retire, ciclo mensual)

| Paso | Contabilidad | Auditoría |
|---|---|---|
| `crearPlanillaMensual` | `AsientoContable` origen `PLANILLA` | `PlanillaDetalle.asientoNumero` enlaza cada detalle al asiento que lo contabilizó |
| `crearGratificacion`/`crearCts` | `AsientoContable` origen `GRATIFICACION`/`CTS` | mismo patrón |
| Liquidación por cese | `AsientoContable` origen `LIQUIDACION` | `LiquidacionDesvinculacion.asientoNumero` |

**Integración verificada como real**: cada corrida de planilla deja un `asientoNumero` trazable en el propio detalle — permite reconciliar "¿qué asiento contabilizó el sueldo de este empleado este mes?" directamente, sin tener que buscar por fecha/monto.

---

## Patrón transversal de integración contable ("best-effort")

Confirmado en múltiples puntos del esquema (`prisma/schema.prisma:1062-1063`, comentario de `ComprobanteElectronico`; y por la existencia de `ControlContable` como mapa opcional): **si una clave de control contable no está configurada, la operación de negocio se completa igual, solo sin generar asiento** — la operación nunca se bloquea por falta de configuración contable. Esto es consistente en todo el sistema (venta, compra, pago, depreciación) y es una decisión de diseño explícita, no un descuido — pero implica que **la completitud del mayor contable depende 100% de que `ControlContable` esté bien configurado**, sin una alerta activa que avise "esta transacción no generó asiento por falta de configuración" más allá de lo que la propia pantalla de Controles Contables muestre pasivamente. **Riesgo a validar a mayor volumen**: un `ControlContable` faltante en producción real podría pasar desapercibido durante un período entero antes de notarse en el balance de comprobación.

## Patrón transversal de auditoría

Todos los modelos transaccionales revisados (`Pedido`, `Factura`, `OrdenCompra`, `RecepcionCompra`, `MovimientoKardex`, `AsientoContable`, `DepreciacionActivo`, `PlanillaDetalle`, etc.) llevan `usuarioId` + `usuarioNombre` (denormalizado, no solo la FK — para que el nombre quede legible aunque el usuario se desactive después) y, donde aplica, motivo obligatorio para regularizaciones (`MovimientoKardex.motivo` cuando `origen = AJUSTE`). **No existe, sin embargo, una tabla de auditoría genérica tipo "change log"** que capture qué campo cambió de qué valor a qué valor en una edición (ej. editar `Cliente.limiteCredito`) — la auditoría es por diseño de dominio (ledgers inmutables) en las áreas transaccionales, pero los catálogos editables (Cliente, Proveedor, Producto, etc.) no tienen historial de cambios de campo. **Gap a evaluar** para una auditoría externa formal a escala grande (ver Blueprint 04, GRC).
