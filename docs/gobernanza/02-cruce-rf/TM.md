# Cruce RF genérico → XXOil: TM (Transportation Management)

**Fuente:** `Requerimientos_Funcionales_SAP_TM.md` (48 RF). **Resultado:** 4 Obligatorio (1 ya cubierto parcialmente, 3 gap real), 2 Deseable, 42 No aplica (M5).

Regla de filtrado del usuario: XXOil tiene flota propia, no terceriza ni licita transporte — todo el bloque de "Compra y venta estratégica de fletes", licitación (tendering) y gestión de transportistas externos (M5) no aplica. Lo que sí aplica es la **ejecución** (`RF-TM-018` a `027`): que un despacho quede vinculado a un vehículo real, con estado y costo — y ahí hay un gap real: `GuiaRemision` ya guarda placa/conductor como texto libre, pero no está vinculada al maestro `Equipo` (que sí existe, con mantenimiento) ni tiene estado de ejecución (planificado/en ruta/entregado) ni costo de flete propio (combustible, peaje) por despacho.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-TM-001 a 005 (necesidad de transporte automática desde pedido, unidad de flete, consolidación) | Parcial | La necesidad de transporte nace del pedido/factura ya (implícito), pero no hay un objeto "unidad de flete" separado — no hace falta esa capa extra para un solo camión/ruta a la vez | Baja | `GuiaRemision` vinculada a `Factura` (M6) |
| RF-TM-006 a 012 (red de transporte, planificación manual/optimizador VSR, simulación) | No | M5 + escala — 4 vendedores en provincias no justifican un optimizador de ruteo; la planificación de ruta la hace el vendedor/despachador a criterio | — | No existe (y no debería) |
| RF-TM-013 a 017 (selección/licitación de transportista, contratos, calificación) | No | M5 — no hay transportistas externos que licitar | — | No aplica |
| RF-TM-018 (creación de órdenes de flete desde unidades de flete) | Sí (gap real) | Es la necesidad real: saber qué vehículo/conductor propio ejecuta cada despacho, con estado | **Obligatorio** | No existe como entidad propia — hoy es texto libre en `GuiaRemision` |
| RF-TM-019, 020 (múltiples órdenes de flete por unidad, multimodal) | No | Flota propia terrestre única — no hay multimodalidad que gestionar | — | No aplica |
| RF-TM-021 (integración con almacén para citas de muelle) | No | M4 — un solo almacén sin muelles formales | — | No aplica |
| RF-TM-022 (documentos de transporte: guías, cartas de porte) | Sí (ya hecho) | Es exactamente la guía de remisión electrónica que ya exige SUNAT | **Obligatorio (ya hecho)** | `GuiaRemision`+`GuiaRemisionDetalle` (M11) |
| RF-TM-023 (comunicación electrónica al transportista externo) | No | M5 — no hay transportista externo a quien comunicar | — | No aplica |
| RF-TM-024 (registro de eventos de ejecución: salida, llegada, incidencias) | Sí (gap real) | Real y simple: saber si un despacho salió/llegó, para dar visibilidad al vendedor/cliente | **Obligatorio** | No existe — `GuiaRemision` no tiene estado de ejecución |
| RF-TM-025 (tracking GPS en tiempo real) | No | Requiere hardware GPS en la flota que XXOil no tiene instalado hoy; sobre-ingeniería sin ese insumo | Fase 3+ | No existe |
| RF-TM-026 (alertas por retrasos/desvíos) | No | Depende de tracking GPS (arriba, no existe) | Fase 3+ | No existe |
| RF-TM-027 (procesos de LSP tercerizado) | No | M5 | — | No aplica |
| RF-TM-028 (cálculo automático de cargo de flete por tarifa/distancia) | Deseable | Útil para saber el costo real de despacho por ruta (combustible, peaje), pero no bloquea operar — hoy se controla vía Libro de Caja como gasto general | Media | Parcial: `MovimientoCaja` registra el gasto sin desglosarlo por despacho |
| RF-TM-029 a 032 (liquidación a transportista, facturación de flete a cliente, distribución de costos, reportes por transportista) | No | M5 — no hay transportista externo a quien liquidar ni cliente al que facturar flete como operador logístico | — | No aplica |
| RF-TM-033 a 035 (compra/venta estratégica de capacidad de flete) | No | M5 | — | No aplica |
| RF-TM-036 (cumplimiento de entrega a tiempo por ruta/vendedor) | Deseable | Valioso para medir desempeño de despacho, pero depende primero de tener estado de ejecución (RF-TM-024, gap real de arriba) | Media (depende del gap anterior) | No existe |
| RF-TM-037 a 039 (utilización de capacidad, KPI logísticos, extracción a BI) | No | M7 + escala — prematuro sin el dato base de ejecución | Fase 3+ | No existe |
| RF-TM-040 a 044 (integración con SD, MM, WM/EWM, MM/FI, CO) | Parcial | La integración con SD/facturación ya existe (`GuiaRemision.facturaId`); con CO para rentabilidad logística sería relevante recién si se separa el costo de flete (ver RF-TM-028) | — | `GuiaRemision.facturaId` (M11 parcial) |
| RF-TM-045 a 048 (transversales: SoD, trazabilidad, no eliminación física, multi-moneda) | Parcial | El patrón general de no-eliminación-física y trazabilidad ya aplica en `GuiaRemision`; multi-moneda no aplica (transporte 100% doméstico) | — | M11 parcial |

**Resumen:** de 48 RF, **3 son gap real y obligatorio** (vincular despacho a `Equipo`, estado de ejecución del despacho, y opcionalmente costo de flete por despacho), **1 ya está cubierto** (guía de remisión electrónica), **3 son deseables de fase 2**, y **41 no aplican** por tener flota propia sin tercerización.
