# Cruce RF genérico → XXOil: WM y EWM (Gestión de Almacenes)

**Actualización (2026-08-05):** el gap #2 identificado abajo (traslado entre zonas del mismo almacén) se construyó — ver `000-Governance/010-AI/inventario-reubicacion-zonas/`. Hallazgo del análisis: `Presentacion`/`Insumo.zonaAlmacenId` es un puntero único de ubicación, no un saldo partido por zona, así que la implementación real es una reubicación de metadato, no un movimiento de kardex nuevo. El gap #1 (tipos de almacenamiento dentro de una zona) sigue sin construir, sin caso de uso identificado.

**Fuentes:** `Requerimientos_Funcionales_SAP_WM.md` (49 RF) + `Requerimientos_Funcionales_SAP_EWM.md` (49 RF), consolidados en un solo documento porque ambos catálogos cubren el mismo proceso (EWM es el sucesor de WM) y el propio documento de WM recomienda evitar duplicar IDs. **Resultado combinado: 4 Obligatorio (ya cubiertos con MM-IM+`ZonaAlmacen`), 2 Deseable, 92 No aplica (M4).**

Regla de filtrado del usuario, confirmada: XXOil tiene almacenes con separación simple (Chiclayo/principal + Trujillo/secundario), no almacenes caóticos de alta rotación. `ZonaAlmacen` (código tipo "A-01", "RACK-2") ya da la granularidad de ubicación que WM básico (Lean WM) pide — sin necesitar órdenes de transporte internas, estrategias de picking FIFO/LIFO automatizadas, ni nada de EWM avanzado (slotting, oleadas, cross-docking, robótica, yard management), que es sobre-ingeniería total confirmada.

**No se produce una tabla de 98 filas** — el patrón se repite de forma casi idéntica en ambos documentos. Se resume por bloque:

| Bloque (WM + EWM) | Aplica | Por qué | Estado |
|---|---|---|---|
| Estructura organizativa del almacén: números de almacén, tipos de almacenamiento, ubicaciones/bins, muelles (RF-WM-004 a 009, RF-EWM-005 a 009) | Parcial | `Almacen`+`ZonaAlmacen` ya dan la estructura mínima (almacén → zona/ubicación); no hay "tipos de almacenamiento" (caótico vs. picking vs. expedición) ni muelles formales, innecesario a este volumen | `Almacen`, `ZonaAlmacen` (M11 parcial, M4 para el resto) |
| Órdenes de transporte internas / unidades de manipulación (RF-WM-010 a 021, RF-EWM-007) | No | M4 — mover una `Presentacion`/`Insumo` de una zona a otra ya se resuelve con el traslado entre almacenes existente (`inventario/traslados`) sin necesitar un documento formal de "orden de transporte" con confirmación en 1-2 etapas | `inventario/traslados` cubre la necesidad real (M6) |
| Picking de entregas de salida, estrategias FIFO/LIFO, picking por voz/RF (RF-WM-022 a 026, RF-EWM-017 a 024) | No | M4 — el despacho de XXOil es "tomar del stock disponible", sin necesitar algoritmo de estrategia de picking; el control de vencimiento por lote (FIFO natural) ya existe en `LoteGranel`/`Presentacion` | Vencimiento por lote ya controlado (M6, M4 para el resto) |
| Inventario a nivel de ubicación, conteo cíclico (RF-WM-027 a 031, RF-EWM-032 a 034) | Sí (ya hecho, a nivel almacén no ubicación) | `ConteoInventario`+`ConteoInventarioDetalle` ya cubre conteo cíclico; no baja al nivel de "ubicación/bin" individual, correcto para el volumen de zonas de XXOil | **Obligatorio (ya hecho)** — `ConteoInventario` (M11) |
| Gestión de recursos/mano de obra, slotting, reorganización, Yard Management (RF-WM-032 a 035, RF-EWM-025 a 031) | No | M4 — no hay volumen de operarios de almacén ni patio de camiones que justifique planificación de carga de trabajo o gestión de patio | No aplica |
| Automatización (AS/RS, PLC, robots) (RF-EWM-035 a 037) | No | M10 — sin equipos automatizados que integrar | No aplica |
| Monitorización en tiempo real, alertas operativas (RF-EWM-038 a 041) | No | M4 — el volumen de despachos diarios no genera cuellos de botella que monitorear en vivo | No aplica |
| Consulta de stock por ubicación/tipo/material en tiempo real (RF-WM-036 a 039) | Sí (ya hecho, a nivel almacén) | `SaldoAlmacen` da stock en tiempo real por almacén; por zona específica no, pero no hace falta | **Obligatorio (ya hecho)** — `SaldoAlmacen`, Kardex (M11) |
| WM vs. EWM: decisión de arquitectura (RF-WM-040, 041, RF-EWM-001 a 004) | Resuelto | Confirmado por el propio usuario: ni WM completo ni EWM — la solución a medida (`Almacen`/`ZonaAlmacen`/`SaldoAlmacen`) es la correcta para el tamaño de XXOil | Decisión ya tomada y validada (M4) |
| Integración con MM-IM, SD, MM-PUR, PP (RF-WM-042 a 045, RF-EWM-042 a 045) | Sí (ya hecho) | Los movimientos de almacén ya están 100% integrados con ventas, compras y producción vía el motor de kardex único | **Obligatorio (ya hecho)** — `registrarMovimiento()` (M11) |
| Transversales: SoD, trazabilidad, no eliminación física, extracción BI (RF-WM-046 a 049, RF-EWM-046 a 049) | Parcial | El patrón general de seguridad/trazabilidad/inmutabilidad ya aplica al kardex | M11 parcial |

**Gaps reales identificados (Deseable, no crítico):**
1. **Tipos de almacenamiento** dentro de una zona (ej. distinguir "área de picking" de "almacenamiento masivo") — solo si el volumen crece lo suficiente para justificarlo.
2. **Traslado entre zonas del mismo almacén** (hoy `inventario/traslados` solo mueve entre almacenes distintos, no entre zonas de un mismo almacén) — bajo esfuerzo si se necesita.

**Resumen combinado:** de 98 RF (WM+EWM), **4 ya están cubiertos** con la solución simple existente, **2 son mejoras menores de fase 2**, y **92 no aplican** — quedando confirmado explícitamente, como pidió el usuario, que EWM completo (y la mayoría de WM clásico) es sobre-ingeniería para el tamaño actual de XXOil.
