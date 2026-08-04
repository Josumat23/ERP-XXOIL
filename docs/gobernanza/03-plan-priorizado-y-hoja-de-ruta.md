# Paso 3 — Plan de mejora priorizado y hoja de ruta (ERP-XXOIL)

**Basado en:** `00-inventario-erp-actual.md` (Paso 0) + las 15 tablas de cruce en `02-cruce-rf/` (Paso 2).

---

## 3.0 Resumen ejecutivo del cruce (Paso 2)

De los **~931 RF** originales en los 17 catálogos (algunas secciones —MRP, MM-IM, WM— aparecen en más de un catálogo fuente y se consolidaron una sola vez para no duplicar el análisis):

| Categoría | Cantidad aprox. | Significado |
|---|---|---|
| **Ya construido y funcionando** | ~148 | Verificado directo en el código — no es intención, ya opera en producción |
| **Gap real, prioridad Fase 1-2** | ~18 | Necesidad de negocio confirmada, no construida todavía |
| **Deseable, Fase 2** | ~51 | Mejora real pero no bloqueante — reportes, refinamientos |
| **No aplica / Fase 3+ explícita** | ~710 | Ceremonia de configuración multi-cliente de SAP (M1), escala corporativa que XXOil no tiene (M2), o funcionalidad fuera del modelo de negocio (M3-M10) |

**Lectura correcta de estos números:** no es que al ERP le falte el 80% de lo que "debería tener" — es que el 80% de un catálogo genérico de SAP está diseñado para clientes de un tamaño y complejidad que XXOil no tiene y no debería imitar. Del 20% restante que sí es negocio real, **~75% ya está construido**.

---

## 3.1 Gaps críticos (Fase 1) — lo que XXOil necesita HOY para dejar el Excel/cuaderno

Ordenados por el criterio explícito del usuario: reemplazar el registro manual.

1. **Nómina básica con aportes legales peruanos** (HCM — ver `HCM.md`). Es la única función de negocio real que sigue 100% en Excel hoy. Requiere: cálculo de sueldo + EsSalud + ONP/AFP + gratificaciones + CTS, boleta de pago, archivo de pago bancario, interfaz contable, y liquidación de desvinculación. **Necesita una sesión de investigación normativa dedicada** (igual que se hizo con SUNAT/PLE) antes de codificar — no se debe inventar la fórmula de cálculo.
2. ~~**Verificación de facturas de proveedor en 3 vías**~~ **— construido y verificado (2026-08-04).** Al recibir, se compara el costo registrado contra el precio pactado en la OC; si la variación supera 5%, la cuenta por pagar queda marcada (`CuentaPorPagar.discrepanciaPrecioPct`) con un badge visible en la lista y el detalle de cuentas por pagar y en la orden de compra — sin bloquear la recepción (regularizaciones no rígidas, tal como pidió el usuario).
3. ~~**Devolución de insumo a proveedor + nota de crédito de proveedor**~~ **— construido y verificado (2026-08-04).** Nuevo modelo `DevolucionCompra`: reduce el stock del insumo (kardex `SALIDA`/`DEVOLUCION_PROVEEDOR`) y aplica el monto como crédito directo contra la cuenta por pagar de esa recepción (vía el nuevo campo `CuentaPorPagar.recepcionCompraId`), con su asiento contable (`postearDevolucionCompra`). Probado end-to-end: devolución de 50 unidades a S/0.88 redujo total 440→396 y saldo 176→132, exacto.
4. **Vincular despacho a vehículo real + estado de ejecución** (TM — ver `TM.md`). `GuiaRemision` ya registra placa/conductor como texto libre; falta vincularlo al maestro `Equipo` (que ya existe con mantenimiento) y darle estado (planificado/en ruta/entregado) para visibilidad real de la flota propia.
5. **Mantenimiento preventivo con planes por tiempo/contador** (PM — ver `PM.md`). Hoy todo mantenimiento es correctivo (reactivo); un plan simple por calendario u horómetro reduciría fallas de flota, que el usuario marcó explícitamente como área en crecimiento.
6. **Catálogo formal de sustancia peligrosa a nivel de Insumo** (EHS — ver `EHS.md`). Ya existe SDS a nivel `Producto` (terminado); falta a nivel materia prima (`Insumo`), que es donde XXOil recibe las sustancias químicas de sus proveedores.
7. **Catálogo estructurado de causas/defectos de calidad + notificación de reclamo de cliente** (QM — ver `QM.md`). Hoy la causa raíz es texto libre; estructurarlo permite reportes agregados ("top 5 defectos"), y falta el lado de reclamo de cliente formal (hoy solo existe la no conformidad interna).
8. **Control de disponibilidad presupuestal bloqueante (AVC) en centros de costo** (CO — ver `CO.md`). El presupuesto existe como plan, pero no bloquea ni alerta si un centro de costo se excede.

**Punto 9 descartado tras verificación:** el ítem original "excluir stock en control de calidad del cálculo de disponibilidad del MRP" (MRP) se verificó directo en el código antes de programar nada — `insumo.stock` ya excluye por diseño lo pendiente de calidad (`resolverInspeccionCompra` solo suma stock al aprobar). No era un gap real; corregido en `MRP.md`.

---

## 3.2 Mejoras sobre lo existente (calidad/validación, no gaps de funcionalidad)

- Reclasificación de costos entre centros (hoy se corrige con asiento manual, funciona pero no es una función dedicada).
- Orden interna genérica reutilizable (hoy solo existe para mantenimiento; útil si aparece un caso de uso como una campaña puntual).
- Reportes de bajo esfuerzo sobre datos que ya existen: rotación/ABC de inventario, exactitud de inventario, backlog de pedidos, evaluación de proveedores por calidad y por precio/plazo, headcount y costo de personal por área.
- Certificados de análisis/conformidad emitibles a clientes industriales/mineros grandes que lo exigen como requisito de compra.
- Versionado de fórmula con vigencia (hoy se edita directo sin histórico).
- ATP del pedido de venta considerando producción planificada, no solo stock actual.

Ninguna de estas bloquea operar hoy — son mejoras de calidad de vida y de reporte gerencial.

---

## 3.3 Deuda de sobre-alcance identificada

**Hallazgo honesto: no se encontró sobre-ingeniería significativa.** A diferencia de lo que sugiere el volumen de RF descartados (~710), el código construido **no** intentó replicar la ceremonia de SAP en ningún módulo — cada vez que se evaluó un catálogo de referencia (Epicor, SAP FI, SAP CO, y ahora estos 17 catálogos), la decisión fue construir la sustancia del requerimiento real y descartar explícitamente la capa de configuración multi-cliente. Esto es visible en decisiones ya tomadas correctamente: MRP determinístico simple en vez de motor multi-método, centros de costo sin jerarquía multinivel innecesaria, un solo objeto `CuentaContable` en vez de "clases de coste" duplicadas.

**Único punto a vigilar, no a corregir:** la fundación de multi-empresa (Fase 1, ya documentada como tal en el propio código) solo filtra `Cliente`/`Proveedor` por empresa activa. Si la expansión internacional no es inminente, no vale la pena extenderla a más entidades todavía — está correctamente detenida donde se necesitaba parar.

---

## 3.4 Hoja de ruta por fases

**Nota sobre la estructura de documentación:** el prompt original de este ejercicio asume una estructura `000-Governance` → `010-AI` → subcarpetas `RF/RN/CU/API/SQL/UI/TEST` por módulo que **no existe en este repositorio** (confirmado en el Paso 0). Los documentos de este ejercicio se guardaron en `docs/gobernanza/` como la ubicación más razonable dentro de la estructura real del proyecto. Adoptar la convención `RF/RN/CU/API/SQL/UI/TEST` por módulo hacia adelante es una decisión de gobernanza que debe tomar el usuario explícitamente — ver pregunta abierta en el mensaje de cierre.

### Fase 1 — Cerrar la brecha con Excel/cuaderno (crítico, corto plazo)
1. Investigación normativa de nómina peruana + construcción de Nómina básica (HCM).
2. Verificación de facturas de proveedor en 3 vías + devolución/NC de proveedor (MM).
3. Vincular despacho a `Equipo` con estado de ejecución (TM).

### Fase 2 — Robustecer lo que ya opera (mediano plazo)
4. Mantenimiento preventivo por planes (PM).
5. Catálogo de sustancia peligrosa a nivel Insumo (EHS).
6. Catálogo estructurado de causas/defectos + reclamo de cliente formal (QM).
7. AVC bloqueante en centros de costo (CO).
8. Ajuste de disponibilidad del MRP excluyendo stock en QC (MRP).
9. Reportes de bajo esfuerzo listados en 3.2, según demanda real de Gerencia.

### Fase 3+ — Crecimiento futuro (no bloquea nada hoy)
10. BI/GRC formal (si XXOil crece a un tamaño que lo justifique).
11. Comercio exterior (cuando la expansión internacional sea real, no solo visión).
12. Reclutamiento, desarrollo de personal, salud ocupacional formal, gestión ambiental (cuando exista un área de RR.HH./SST dedicada).
13. Certificados de análisis automáticos, evaluación formal de proveedores (cuando el volumen de clientes industriales grandes lo demande).
