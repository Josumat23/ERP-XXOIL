# CU — Casos de uso — proyectos

## CU-PRY-001 — Crear un proyecto de capital
- **Actor:** GERENCIA
- **Flujo:** desde `/proyectos/nuevo`, ingresa nombre, presupuesto total, fechas planificadas, y opcionalmente responsable y centro de costo sponsor.
- **Postcondición:** nace `PLANIFICADO`, con código correlativo `PRY-00001`.

## CU-PRY-002 — Construir la WBS y la red de actividades
- **Actor:** GERENCIA
- **Flujo:** desde el detalle del proyecto, agrega fases (con subfases opcionales) y, dentro de cada fase, actividades con duración en días. Luego declara precedencias entre actividades (predecesora → sucesora).
- **Postcondición:** cada cambio recalcula automáticamente fecha de inicio/fin planificada, si es crítica y su holgura, para todas las actividades del proyecto.

## CU-PRY-003 — Identificar la ruta crítica
- **Actor:** GERENCIA
- **Flujo:** revisa la tabla de actividades de cada fase; las marcadas "Crítica" (holgura 0) son las que, si se atrasan, atrasan el proyecto completo.
- **Postcondición:** Gerencia sabe dónde concentrar seguimiento sin tener que calcularlo a mano.

## CU-PRY-004 — Registrar costo real
- **Actor:** GERENCIA
- **Flujo (dos caminos, no excluyentes):**
  1. Agrega un costo manual (ej. mano de obra) desde el proyecto, opcionalmente atribuido a una fase.
  2. Etiqueta una Orden de Compra a este proyecto/fase al crearla en `/logistica/ordenes-compra/nuevo`.
- **Postcondición:** el "Costo real" del proyecto refleja la suma de ambas fuentes sin doble registro; si supera el presupuesto, se alerta visualmente (no bloquea).

## CU-PRY-005 — Capitalizar como activo fijo
- **Actor:** GERENCIA
- **Precondición:** el proyecto tiene costo real acumulado.
- **Flujo:** desde el detalle del proyecto, "Capitalizar como activo fijo" lleva a `/finanzas/activos-fijos/nuevo` prellenado (nombre y costo de adquisición = costo real), donde confirma categoría, vida útil y fecha antes de guardar.
- **Postcondición:** nace un `ActivoFijo` con `proyectoId` vinculado, que entra al motor de depreciación existente sin cambios. El proyecto no se cierra automáticamente.

## CU-PRY-006 — Cerrar o cancelar el proyecto
- **Actor:** GERENCIA
- **Flujo:** cambia el estado a `CERRADO` o `CANCELADO` desde el detalle.
- **Postcondición:** queda registrada `fechaFinReal` (si es la primera vez que pasa a EN_PROGRESO/CERRADO).
