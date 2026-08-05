# RN — Reglas de negocio — proyectos

| ID | Regla | Por qué |
|---|---|---|
| RN-PRY-001 | Solo precedencia Fin-a-Inicio entre actividades — sin lags ni tipos SS/FF/SF. | XXOil ejecuta 1-3 proyectos de capital a la vez, no una cartera de obras con dependencias complejas; el resto de SAP-PS es aparataje que no se necesita para ese volumen. |
| RN-PRY-002 | Sin nivelación de capacidad de recursos: `responsableId`/`equipoId` en una actividad son un dato informativo (quién es responsable), no un algoritmo de balanceo de carga entre actividades simultáneas. | Un responsable puede figurar en varias actividades a la vez sin que el sistema lo bloquee — no hay volumen de recursos que justifique resolver conflictos de asignación automáticamente. |
| RN-PRY-003 | La ruta crítica se calcula en días corridos desde `Proyecto.fechaInicioPlan`, sin calendario de días hábiles/feriados. | Evita construir un calendario laboral completo para una funcionalidad que hoy sirve para 1-3 proyectos; el margen de error de "días corridos vs. hábiles" es aceptable para planificación de alto nivel. |
| RN-PRY-004 | `Proyecto.centroCostoId` es una etiqueta informativa (qué área/sponsor lo pidió) — nunca se postea contra ese centro. | Un proyecto de capital acumula costo como WIP hasta capitalizarse en un `ActivoFijo`; postearlo contra un centro de costo lo trataría incorrectamente como gasto de período (P&L), inflando el resultado del área sponsor sin que corresponda. |
| RN-PRY-005 | El costo real del proyecto es 100% calculado: suma de `CostoProyecto` (ledger manual) + `OrdenCompra` etiquetadas con `estado != ANULADA` (convertidas a PEN con su tipo de cambio). No existe un campo `totalAcumulado` que se pueda desincronizar. | Mismo principio que el resto del sistema (kardex, saldos): los totales derivados se calculan al vuelo, no se persisten, para que nunca queden desactualizados respecto a su fuente. |
| RN-PRY-006 | No se puede eliminar una actividad que tenga otras actividades dependiendo de ella como predecesora. | Evita romper silenciosamente la red de precedencias — si hay dependientes, hay que resolver esa dependencia primero (borrarla o reasignarla). |
| RN-PRY-007 | Toda precedencia nueva se valida contra ciclos (DFS) antes de insertarse. | Un ciclo en el grafo de actividades hace que el CPM (orden topológico) no pueda calcular ES/EF/LS/LF para las actividades atrapadas en él. |
| RN-PRY-008 | Capitalizar un proyecto no lo cierra automáticamente — son dos pasos independientes. | Un proyecto grande puede generar más de un activo fijo (ej. edificio + maquinaria) antes de darse por terminado; forzar el cierre en la primera capitalización sería incorrecto. |
| RN-PRY-009 | Crear/gestionar proyectos requiere rol GERENCIA. | Es una decisión de inversión de capital, no una operación transaccional del día a día — mismo nivel de rol que Órdenes internas y Activos fijos. |

## Exclusiones explícitas frente a SAP-PS completo
- Sin workflow de aprobación de presupuesto por fase.
- Sin AVC (control de disponibilidad) bloqueante a nivel de WBS.
- Sin multi-moneda propia del proyecto (el costo se normaliza a PEN al agregarse, igual que el resto de reportes financieros).
- Sin liquidación multi-elemento ni facturación de proyecto contra hitos (XXOil no vende proyectos a cliente).
