# UI — Pantallas — proyectos

## `/proyectos` (nueva)
- Lista estilo `PanelMaestroDetalle`: código, nombre, responsable, presupuesto, costo real (rojo si excede presupuesto), estado. Filtro por texto y estado.

## `/proyectos/nuevo` (nueva)
- Formulario de cabecera: nombre, descripción, centro de costo sponsor (opcional), responsable (opcional), presupuesto total, fechas plan.

## `/proyectos/[id]` (nueva)
- KPIs: costo real vs. presupuesto total, con alerta visual si se excede (no bloqueante).
- Selector de estado con botón "Cambiar estado".
- **WBS**: árbol de fases/subfases renderizado recursivamente, cada una con su tabla de actividades (código, nombre, duración, inicio/fin plan, holgura, responsable, equipo, badge "Crítica" en rojo si `esCritica`) y botón eliminar por actividad. Formulario "+ Agregar fase" (con selector de fase padre) y "+ Agregar actividad" por cada fase.
- **Precedencias**: tabla de precedencias existentes (con eliminar) + formulario predecesora/sucesora. Solo se muestra si hay ≥ 2 actividades.
- **Costos reales**: ledger (fecha, concepto, fase, quién, monto) + formulario "+ Agregar costo".
- **Órdenes de compra etiquetadas**: tabla de solo lectura con link a cada OC.
- **Activos fijos capitalizados**: tabla de solo lectura con link a cada activo + botón "Capitalizar como activo fijo".

## `/logistica/ordenes-compra/nuevo` (extendida)
- Selector "Proyecto (opcional)" — solo se muestra si existen proyectos `PLANIFICADO`/`EN_PROGRESO`. Al elegir uno, aparece un segundo selector "Fase (opcional)" filtrado a las fases de ese proyecto.

## `/finanzas/activos-fijos/nuevo` (extendida)
- Si llega `?proyectoId=...`, muestra un aviso "Capitalizando el proyecto X" y prellena nombre/costo de adquisición con los datos del proyecto (editable).

## Navegación
- `src/lib/navegacion.ts`: nuevo módulo top-level **"Proyectos"** (roles `ADMIN`, `GERENCIA`), con un único enlace a `/proyectos`. Nombre elegido para no confundir con "Proyecciones" (forecasting comercial, ya existente).
- `src/app/(app)/configuracion/grupos-seguridad/modulos.ts`: nueva clave de módulo `proyectos` para el sistema de permisos por grupo de seguridad.
- No se agregó a `/reportes` — es un módulo transaccional, no un reporte (mismo criterio que Órdenes internas).
