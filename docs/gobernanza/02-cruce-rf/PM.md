# Cruce RF genérico → XXOil: PM (Plant Maintenance)

**Fuente:** `Requerimientos_Funcionales_SAP_PM.md` (53 RF). **Resultado:** 8 Obligatorio (mayoría ya construida), 4 Deseable, 41 No aplica.

**Corrección importante sobre la instrucción original:** el prompt del usuario asume que PM "hoy no existe" en XXOil y lo marca prioridad media-alta como área en crecimiento. El inventario del Paso 0 muestra que **esto ya no es así** — el mantenimiento de equipos/flota (`Equipo`, `OrdenMantenimiento`, `RepuestoOrdenMantenimiento`) se construyó en una sesión anterior de este mismo proyecto, con reserva real de repuestos contra stock, costeo y liquidación a centro de costo. Lo que falta es específicamente el submódulo de **mantenimiento preventivo con planes/ciclos** (PM-PRM) — hoy el mantenimiento es 100% correctivo (se crea una orden cuando algo falla), no hay generación automática de órdenes por calendario u horómetro.

| RF-ID | Aplica | Por qué | Prioridad real | Estado en código |
|---|---|---|---|---|
| RF-PM-001 a 003 (ubicaciones técnicas, equipos, traslado con historial) | Parcial | `Equipo` ya existe con datos de fabricante/modelo; no hay jerarquía de "ubicación técnica" separada, innecesaria para el volumen de equipos de XXOil (planta + flota, no cientos de activos) | Ya hecho lo esencial | `Equipo` (M11, M1 para la jerarquía completa) |
| RF-PM-004 (BOM técnica/conjuntos) | No | M3-adyacente — sobra para el volumen de equipos de XXOil | — | No existe |
| RF-PM-005 (clasificación por características) | No | Sobra para el volumen actual | Fase 3+ | No existe |
| RF-PM-006 (historial completo por equipo) | Sí (ya hecho) | `OrdenMantenimiento` vinculada a `Equipo` da el historial completo | **Obligatorio (ya hecho)** | `OrdenMantenimiento.equipoId` (M11) |
| RF-PM-007 (vínculo a activo fijo FI-AA) | Deseable | Útil para saber el valor en libros del equipo que se está manteniendo; hoy son entidades separadas (`Equipo` y `ActivoFijo`) sin relación explícita | Media | `Equipo` y `ActivoFijo` no están vinculados |
| RF-PM-008 (contadores de medición: horómetro, odómetro) | Sí (gap real) | Necesario para mantenimiento preventivo basado en uso (ej. cambio de aceite cada X horas de motor en la flota) | **Obligatorio (para preventivo)** | No existe |
| RF-PM-009 (calibración de instrumentos de medición) | No | XXOil no reportó tener instrumentos de calibración crítica fuera de control de calidad (que ya se maneja aparte) | Fase 3+ | No existe |
| RF-PM-010 a 018 (estrategias, planes de mantenimiento preventivo, ciclos por tiempo/contador, generación automática de llamadas) | **Sí — gap real** | Esto es lo que realmente falta: hoy todo mantenimiento es correctivo (reactivo); un plan preventivo simple (ej. "cada 30 días" o "cada 5000 km") reduciría fallas de flota, que es justo el área que el usuario espera que crezca | **Obligatorio (Fase 2)** | No existe — `OrdenMantenimiento` se crea siempre manual |
| RF-PM-019 a 025 (avisos de mantenimiento: clases, prioridad, tiempos de parada, conversión a orden) | Parcial | XXOil va directo a `OrdenMantenimiento` sin un paso previo de "aviso" — funciona para su volumen actual, aunque pierde la separación entre "reportar una falla" y "decidir atenderla" | Baja (funciona sin esto) | No existe capa de aviso separada (M6) |
| RF-PM-026 a 032 (órdenes de mantenimiento: correctivo/preventivo, reserva de repuestos, solicitud de compra, ciclo de estados, confirmación, liquidación) | Sí (ya hecho) | Es exactamente lo construido: `OrdenMantenimiento`+`RepuestoOrdenMantenimiento` con reserva real de stock y liquidación a centro de costo | **Obligatorio (ya hecho)** | `OrdenMantenimiento`, `RepuestoOrdenMantenimiento`, `postearMantenimiento()` (M11) |
| RF-PM-033 (paradas de planta mayores con estructura de proyecto) | No | M8 — XXOil no tiene paradas de planta de la envergadura que justifique una red de tareas tipo PS | Fase 3+ | No existe |
| RF-PM-034 (impresión de documentos de trabajo) | Deseable | Se resuelve con `BotonImprimir`, ya reutilizable | Baja | Patrón ya existe, falta aplicarlo a la orden de mantenimiento |
| RF-PM-035 (permisos de trabajo/seguridad) | No | Ligado a EHS, que es fase futura salvo sustancias peligrosas | Fase 3+ | No existe |
| RF-PM-036 a 039 (servicio a cliente: órdenes de servicio, garantías, contratos, facturación) | No | XXOil no vende servicio técnico a clientes — solo mantiene sus propios equipos/flota | — | No aplica |
| RF-PM-040 (disponibilidad/confiabilidad MTBF/MTTR) | Deseable | Valioso una vez exista un histórico suficiente de órdenes; prematuro hoy | Fase 3+ | No existe |
| RF-PM-041 (costos de mantenimiento por equipo/centro de costo) | Sí (ya hecho) | Ya se liquida a centro de costo | **Obligatorio (ya hecho)** | `postearMantenimiento()` con `centroCostoId` (M11) |
| RF-PM-042 (cumplimiento de plan preventivo: ejecutado vs. programado) | No | Depende de que exista el plan preventivo primero (arriba, gap real) | Ligado al gap de arriba | No existe |
| RF-PM-043 (órdenes abiertas/vencidas por responsable) | Deseable | Reporte simple, bajo esfuerzo | Media | Parcial: existe el dashboard de alerta de mantenimiento pendiente/vencido, pero no desglosado por responsable |
| RF-PM-044 (extracción a BI) | No | M7 | — | No existe |
| RF-PM-045, 046 (integración MM para repuestos, CO/FI-AA para liquidación) | Sí (ya hecho) | Ya integrado | **Obligatorio (ya hecho)** | `RepuestoOrdenMantenimiento` descuenta stock real; liquidación a CeCo (M11) |
| RF-PM-047 a 049 (integración QM, PP, SD) | No | No aplica — XXOil no reporta fallas de calidad desde mantenimiento ni coordina con producción discreta ni factura servicio a cliente | — | No aplica |
| RF-PM-050 a 053 (transversales: SoD, trazabilidad, no eliminación física, multi-planta) | Sí (ya hecho) | El patrón general ya aplica a `OrdenMantenimiento` | **Obligatorio (ya hecho)** | M11 |

**Resumen:** de 53 RF, **8 ya están construidos** (el "esqueleto" correctivo completo, con repuestos e integración contable), **1 es gap real crítico** (mantenimiento preventivo con planes por tiempo/contador — la mejora que de verdad reduciría fallas de flota), **4 son deseables de fase 2**, y **41 no aplican** por escala o por no ser el modelo de negocio de XXOil (servicio a cliente, paradas de planta tipo proyecto).
