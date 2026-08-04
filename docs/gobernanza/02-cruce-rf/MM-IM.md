# Cruce RF genérico → XXOil: MM-IM (Gestión de Inventarios)

**Fuente:** `Requerimientos_Funcionales_SAP_MM-IM.md` (52 RF). **Resultado:** 20 Obligatorio (17 ya construidos — módulo maduro), 6 Deseable, 26 No aplica.

MM-IM es el núcleo del sistema y está bien cubierto: todo movimiento de mercadería (compra, venta, producción, ajuste, traslado) pasa por un único choke-point (`registrarMovimiento()` en `src/lib/inventario.ts`), que mantiene sincronizados el saldo por almacén y el stock agregado, valida negativos, y genera kardex inmutable. Los gaps reales son puntuales: reversa formal de un movimiento (hoy se corrige con un ajuste nuevo, válido pero distinto del "movimiento de reverso" de SAP) y análisis ABC/rotación.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-MMIM-001 (entrada con referencia a OC) | Sí (ya hecho) | Recepción de compra actualiza stock y OC | **Obligatorio (ya hecho)** | `RecepcionCompra` (M11) |
| RF-MMIM-002 (entrada sin referencia, carga inicial) | Sí (ya hecho) | Ajustes de inventario tipo entrada | **Obligatorio (ya hecho)** | `inventario/ajustes` origen AJUSTE (M11) |
| RF-MMIM-003 (entrada con referencia a reserva/orden de producción) | Sí (ya hecho) | Entrada de producto terminado al envasar | **Obligatorio (ya hecho)** | `Envasado` (M11) |
| RF-MMIM-004 (tolerancias de sub/sobre-entrega) | No | XXOil recibe exactamente lo pedido o registra la diferencia manual; no hay volumen que justifique tolerancias configurables por material | Fase 3+ | No existe |
| RF-MMIM-005 (entrada parcial en múltiples recepciones) | Sí (ya hecho) | `RecepcionCompra` permite recepciones parciales sucesivas contra la misma OC | **Obligatorio (ya hecho)** | `OrdenCompraDetalle.cantidadRecibida` (M11) |
| RF-MMIM-006 (dirigir entrada a libre/QC/bloqueado) | Sí (ya hecho) | Vía `InspeccionCompra` cuando el insumo requiere control de calidad | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-007 (documento de material + documento contable) | Sí (ya hecho) | Cada movimiento genera kardex y, cuando aplica, asiento contable automático | **Obligatorio (ya hecho)** | `registrarMovimiento()` + `postearRecepcionCompra()` (M11) |
| RF-MMIM-008 (etiqueta/comprobante de recepción) | Deseable | Bajo esfuerzo con `BotonImprimir` | Baja | No aplicado a recepciones |
| RF-MMIM-009 (devolución a proveedor) | No | Gap real — no existe un flujo de devolución de insumo a proveedor por defecto (sí existe para clientes: devolución de ventas) | Media | No existe |
| RF-MMIM-010 a 013 (salidas: consumo interno, producción, venta, mermas/obsolescencia) | Sí (ya hecho) | Todos los orígenes de salida están cubiertos vía `origen` del movimiento (COMPRA, VENTA, AJUSTE, TRASLADO) | **Obligatorio (ya hecho)** | `TipoMovimiento`/`OrigenMovimiento` enums (M11) |
| RF-MMIM-014 (validación de disponibilidad antes de salida) | Sí (ya hecho) | `registrarMovimiento()` rechaza si dejaría saldo negativo | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-015 (reversa de salida manteniendo trazabilidad del original) | No (gap real) | Hoy se corrige con un ajuste nuevo (origen AJUSTE), lo cual es válido y auditable, pero no está vinculado formalmente al movimiento original que se está corrigiendo | Media | Ajuste manual sin vínculo al original |
| RF-MMIM-016, 017 (traslado entre almacenes/centros) | Sí (ya hecho) | `inventario/traslados` | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-018 (traspaso entre tipos de stock sin desplazamiento físico) | Sí (ya hecho) | Resolución de inspección de calidad mueve de "control de calidad" a "disponible" sin movimiento físico | **Obligatorio (ya hecho)** | `InspeccionCompra` → `cantidadDisponible` (M11) |
| RF-MMIM-019 (traspaso/re-etiquetado entre lotes) | No | Bajo volumen de necesidad; se resolvería manual si ocurriera | Fase 3+ | No existe |
| RF-MMIM-020 (consignación de proveedor) | No | XXOil no maneja stock en consignación de proveedores hoy | — | No aplica |
| RF-MMIM-021 (impacto contable automático en cada traspaso) | Sí (ya hecho) | El motor de asientos automáticos cubre todo movimiento relevante | **Obligatorio (ya hecho)** | `src/lib/contabilidad.ts` (M11) |
| RF-MMIM-022 a 025 (reservas de material) | No | XXOil no reserva material con anticipación para producción — el lote consume directo al fabricar; para pedidos de venta sí existe reserva (`stockReservado` en `Presentacion`) | Ya cubierto para ventas (M6) | `Presentacion.stockReservado` (M11 parcial) |
| RF-MMIM-026, 027 (lote con trazabilidad y bloqueo por calidad) | Sí (ya hecho) | Es uno de los módulos más maduros del sistema — trazabilidad de lote hacia cliente y hacia proveedor de materia prima | **Obligatorio (ya hecho)** | `LoteGranel`, `AsignacionLoteVenta`, `AsignacionLoteInsumo` (M11) |
| RF-MMIM-028 a 030 (consignación, subcontratación, stock especial de proyecto) | No | XXOil no maneja ninguno de estos tres modelos de stock especial | — | No aplica |
| RF-MMIM-031 a 034 (inventario físico: documento, bloqueo durante conteo, comparación, contabilización de diferencias) | Sí (ya hecho) | `ConteoInventario`+`ConteoInventarioDetalle` | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-035 (inventario cíclico) | Sí (ya hecho) | Es exactamente el propósito de `ConteoInventario` | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-036 (ajuste directo sin documento previo) | Sí (ya hecho) | `inventario/ajustes` | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-037 (reporte de exactitud de inventario) | Deseable | Reporte derivado de `ConteoInventarioDetalle`, bajo esfuerzo | Media | No existe como reporte agregado |
| RF-MMIM-038, 039 (consulta de stock en tiempo real, historial de movimientos) | Sí (ya hecho) | `SaldoAlmacen`, `inventario/kardex` | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-040 (tolerancias por tipo de movimiento) | No | M1 | — | No aplica |
| RF-MMIM-041 (alerta de stock bajo mínimo) | Deseable | El MRP ya identifica faltantes contra demanda proyectada; una alerta pasiva de "stock bajo mínimo" independiente del MRP sería un complemento | Media | Cubierto indirectamente por MRP (M6 parcial) |
| RF-MMIM-042 (rotación, obsolescencia, análisis ABC) | Deseable | Valioso para negociar compras y detectar insumos sin movimiento; no bloqueante | Media | No existe |
| RF-MMIM-043 (días de inventario, tasa de cumplimiento desde stock) | Deseable | Reporte derivado, bajo esfuerzo una vez exista el dato base | Baja | No existe |
| RF-MMIM-044 a 048 (integración FI, PP, SD, WM/EWM, PM) | Sí (ya hecho, salvo WM/EWM que no aplica) | Todo movimiento relevante ya genera su asiento contable y está integrado con producción/ventas/mantenimiento | **Obligatorio (ya hecho)** | M11 |
| RF-MMIM-049 a 052 (transversales: SoD, no eliminación física, trazabilidad, extracción BI) | Sí (ya hecho, salvo BI) | Patrón general del sistema | **Obligatorio (ya hecho)** | M11 |

**Resumen:** de 52 RF, **17 ya están construidos** (el kardex único, trazabilidad de lote, inventario físico, integración contable), **2 son gap real** (devolución de insumo a proveedor; vínculo formal reverso↔movimiento original), y **6 son deseables de fase 2** (reportes de rotación/ABC/exactitud, alerta de stock bajo mínimo, etiqueta de recepción) — **26 no aplican** por ser stock especial/tolerancias configurables que XXOil no necesita.
