# Cruce RF genérico → XXOil: MM (Gestión de Materiales — general)

**Fuente:** `Requerimientos_Funcionales_SAP_MM.md` (81 RF). Las secciones 4 (MM-IM), 5 (MM-WM) y 7 (MRP) de este catálogo se cruzan en `MM-IM.md`, `WM-EWM.md` y `MRP.md` respectivamente, para no duplicar — aquí solo MM-MD (datos maestros), MM-PUR (compras), MM-IV (verificación de facturas), MM-SRV (servicios) y Valoración. **Resultado de estas secciones: 24 Obligatorio (20 ya construidos), 5 Deseable, 22 No aplica.**

Regla de filtrado del usuario: prioriza datos maestros de materia prima química, control de lotes, vencimiento, y verificación de facturas de proveedores; descarta manufactura discreta compleja. Verificado: el ciclo de compras (OC con aprobación por monto → recepción con costo promedio ponderado → cuenta por pagar → pago) está completo y es de los módulos más maduros del sistema. El gap real es la **verificación de facturas en 3 vías** (RF-MM-050, MM-IV) — hoy la cuenta por pagar se genera directo desde la recepción, sin un paso separado de "verificar la factura del proveedor contra lo pedido y lo recibido" cuando llega después.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-MM-001 a 004 (registro de material por centro/almacén, tipo de material, grupos, múltiples UM) | Sí (ya hecho) | `Insumo`/`Presentacion` con tipo, conversión de unidades | **Obligatorio (ya hecho)** | M11 |
| RF-MM-005 a 007 (datos de compras, MRP, valoración por material) | Sí (ya hecho) | Costo promedio ponderado por `Insumo`; parámetros MRP ver `MRP.md` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-008, 009 (proveedor con datos generales/compras/financieros, condiciones comerciales) | Sí (ya hecho) | `Proveedor` con datos bancarios, multi-moneda, condición de pago | **Obligatorio (ya hecho)** | M11 |
| RF-MM-010 (listas de precios/condiciones de compra con vigencia) | No | XXOil negocia precio por orden de compra directa, no mantiene una lista de precios de proveedor con vigencia formal | Fase 3+ | No existe |
| RF-MM-011 (materiales sustitutos/equivalentes) | No | Bajo volumen de insumos, no justifica el concepto | — | No aplica |
| RF-MM-012 (extensión de material a nuevos centros sin duplicar) | Sí (ya hecho) | Un `Insumo`/`Presentacion` es único y se usa en todos los almacenes vía `SaldoAlmacen` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-013 (histórico de cambios en datos maestros) | No | Bajo volumen | Fase 3+ | No existe |
| RF-MM-014 (carga masiva) | No | Volumen bajo | — | No aplica |
| RF-MM-015, 016 (solicitud de pedido interna con flujo de aprobación) | No | XXOil no tiene el paso de "solicitud de pedido" separado de la orden de compra — quien compra genera la OC directo, con aprobación por monto ya construida en la OC misma | — | Cubierto de forma más directa por `OrdenCompra.estadoAprobacion` (M6) |
| RF-MM-017 (convertir solicitud en OC o RFQ) | No | Ligado al RF anterior | — | No aplica |
| RF-MM-018 (RFQ y comparación de ofertas) | No | XXOil no cotiza formalmente a varios proveedores en el sistema — se negocia fuera del sistema y se registra la OC ya decidida | Fase 3+ | No existe |
| RF-MM-019 (creación/modificación/liberación de OC) | Sí (ya hecho) | `OrdenCompra`+`OrdenCompraDetalle` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-020 (aprobación de OC por monto) | Sí (ya hecho) | `OrdenCompra.estadoAprobacion` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-021 (contratos marco, programas de suministro) | No | XXOil no maneja contratos marco de compra con proveedores | Fase 3+ | No existe |
| RF-MM-022 (determinación automática de fuente de aprovisionamiento) | No | Bajo volumen de proveedores por insumo — se elige manual | — | No aplica |
| RF-MM-023 (estado de OC: pendiente/parcial/cerrada/bloqueada) | Sí (ya hecho) | `OrdenCompra.estado` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-024 (envío de OC al proveedor por correo/EDI) | No | Se comunica fuera del sistema (WhatsApp/correo manual) — bajo volumen no justifica automatizarlo | Fase 3+ | No existe |
| RF-MM-025 (condiciones de precio/descuento/impuesto a nivel de posición) | Sí (ya hecho) | `OrdenCompraDetalle.costoUnitario` con multi-moneda | **Obligatorio (ya hecho)** | M11 |
| RF-MM-026 (modificar/cancelar posiciones respetando histórico) | Sí (ya hecho) | El patrón de no-eliminación-física aplica | **Obligatorio (ya hecho)** | M11 |
| RF-MM-027 (evaluación de proveedores por precio/calidad/plazo) | Deseable | Ligado a `QM.md` (evaluación por tasa de rechazo) — valioso, bajo esfuerzo una vez existan los reportes de calidad | Media | No existe |
| RF-MM-028 (reportes de compras pendientes/por proveedor/material/CeCo) | Sí (ya hecho, mayormente) | `logistica/ordenes-compra` con filtros | **Obligatorio (ya hecho)** | M11 |
| RF-MM-029 (compras de servicios con hoja de entrada previa a facturación) | No | XXOil compra materia prima/insumos físicos, no reportó compras de servicio con aceptación previa | Fase 3+ | No existe |
| RF-MM-030 (compra menor/caja chica simplificada) | Deseable | Los gastos menores ya pasan por `MovimientoCaja` sin necesitar un flujo de OC completo — funciona, aunque no está etiquetado como "compra menor" formal | Baja | Cubierto por `MovimientoCaja` (M6) |
| RF-MM-049 (registro de factura con verificación 3 vías: OC↔recepción↔factura) | **No (gap real)** | Hoy `CuentaPorPagar` se genera automático desde la recepción, asumiendo que lo recibido = lo facturado; si la factura del proveedor llega después con un monto distinto, no hay un paso de conciliación formal | **Obligatorio (gap real, prioridad media-alta)** | `CuentaPorPagar` se crea directo desde `RecepcionCompra`, sin verificación de factura separada |
| RF-MM-050 (validar cantidad/precio facturado vs. pedido/recibido) | No (mismo gap) | Ver arriba | Ligado al RF-MM-049 | No existe |
| RF-MM-051 (bloqueo de pago por diferencias fuera de tolerancia) | No (mismo gap) | Ver arriba | Ligado al RF-MM-049 | No existe |
| RF-MM-052 (notas de crédito y devoluciones de proveedor) | Parcial | Devolución de proveedor es gap real (ver `MM-IM.md`); nota de crédito de proveedor tampoco existe como documento propio | Media | No existe |
| RF-MM-053 (cálculo automático de impuestos en factura de compra) | Sí (ya hecho) | IGV/PLE de compras ya calculado (`libros-electronicos`) | **Obligatorio (ya hecho)** | M11 |
| RF-MM-054 (documento contable de factura verificada) | Sí (ya hecho) | `postearRecepcionCompra` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-055 (historial de facturas por OC) | Sí (ya hecho) | Visible en el detalle de la OC | **Obligatorio (ya hecho)** | M11 |
| RF-MM-056 (verificación de servicios contra hoja de entrada) | No | Ligado a RF-MM-029, no aplica | — | No aplica |
| RF-MM-057 (variaciones de precio/diferencias de facturación) | No (mismo gap que RF-MM-049) | — | Ligado al gap de verificación de facturas | No existe |
| RF-MM-064 a 066 (MM-SRV: servicios externos, hoja de entrada, pedidos abiertos de servicio) | No | XXOil no reportó compras de servicio recurrente que ameriten este submódulo | Fase 3+ | No existe |
| RF-MM-067, 068 (valoración estándar/media móvil, ejecución periódica de determinación de precio) | Sí (ya hecho) | Costo promedio ponderado (media móvil) por insumo | **Obligatorio (ya hecho)** | M11 |
| RF-MM-069 (registro contable automático de todo movimiento que afecte valor de inventario) | Sí (ya hecho) | `src/lib/contabilidad.ts` | **Obligatorio (ya hecho)** | M11 |
| RF-MM-070 (Material Ledger para valoración multi-moneda) | No | XXOil ya resuelve multi-moneda de forma más simple (conversión a PEN al momento de la transacción vía `TipoCambio`), sin necesitar un ledger paralelo por moneda | — | `TipoCambio`, conversión directa (M1) |
| RF-MM-071 (reporte de valorización de inventario a fecha de corte) | Deseable | Bajo esfuerzo sobre `SaldoAlmacen`/costo promedio existentes | Media | No existe como reporte dedicado |
| RF-MM-072 a 076 (integración FI, CO, PP, SD, PM) | Sí (ya hecho) | Todo integrado vía el motor de asientos único | **Obligatorio (ya hecho)** | M11 |
| RF-MM-077 a 081 (transversales: SoD, trazabilidad solicitud→pago, no eliminación física, extracción BI, multi-moneda/idioma) | Sí (ya hecho, salvo BI) | El patrón general aplica; multi-moneda ya existe en compras | **Obligatorio (ya hecho)** | M11 |

**Resumen (solo secciones no cubiertas en otros documentos):** de 81 RF originales, tras descontar los que ya se cruzaron en `MM-IM.md`/`WM-EWM.md`/`MRP.md`, quedan ~51 RF propios de MM-MD/MM-PUR/MM-IV/MM-SRV/Valoración. De esos, **20 ya están construidos**, **1 es un gap real de prioridad media-alta** (verificación de facturas en 3 vías, con sus 3 RF asociados: MM-049, 050, 051, más nota de crédito de proveedor en MM-052), **5 son deseables de fase 2**, y **22 no aplican** por ser procesos de compra (RFQ, contratos marco, servicios recurrentes) que XXOil no maneja hoy.
