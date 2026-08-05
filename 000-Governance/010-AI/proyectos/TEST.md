# TEST — Verificación — proyectos

## Escenario 1 — CPM con caso matemáticamente inequívoco
- **Pasos:** proyecto `PRY-00001`, fase "Obra civil", 4 actividades (A=2d, B=5d, C=2d, D=3d), precedencias A→B, B→D, A→C, C→D.
- **Resultado esperado:** camino A→B→D = 10 días (crítico), camino A→C→D = 7 días, holgura de C = 3 días.
- **Resultado obtenido:** exacto — A, B, D marcadas "Crítica" con holgura 0; C con holgura 3 días. Fechas: A 31/08–02/09, B 02/09–07/09, C 02/09–04/09, D 07/09–10/09 (coincide con inicio de proyecto 01/09, desfasado un día en pantalla por zona horaria de visualización — comportamiento preexistente del resto del sistema con `<input type="date">`, no introducido por este cambio).

## Escenario 2 — Detección de ciclos
- **Pasos:** con la red del escenario 1, intentar agregar precedencia D→A (cerraría el ciclo A→B→D→A).
- **Resultado esperado:** rechazada con mensaje explícito, red sin cambios.
- **Resultado obtenido:** exacto — "Esa precedencia formaría un ciclo en la red de actividades."

## Escenario 3 — Costo real sin doble registro
- **Pasos:** agregar costo manual S/15,000; crear OC-00003 por S/2,000 etiquetada al proyecto.
- **Resultado esperado:** costo real del proyecto = S/17,000.00 (suma exacta, sin duplicar).
- **Resultado obtenido:** exacto, verificado tanto en la lista `/proyectos` como en el detalle.

## Escenario 4 — Guarda de eliminación con dependientes
- **Pasos:** intentar eliminar la actividad A (tiene a B y C como sucesoras dependientes).
- **Resultado esperado:** no se elimina, red intacta.
- **Resultado obtenido:** exacto.

## Escenario 5 — Capitalización
- **Pasos:** desde el proyecto con costo real S/17,000, "Capitalizar como activo fijo" → formulario prellenado (nombre y costo S/17,000) → completar categoría/fecha/vida útil → guardar.
- **Resultado esperado:** nace `AF-00001` con `proyectoId` vinculado, visible en la lista de activos capitalizados del proyecto y en `/finanzas/activos-fijos`; el proyecto permanece `PLANIFICADO` (no se cierra solo).
- **Resultado obtenido:** exacto.

## Escenario 6 — Subfases anidadas y asignación de equipo
- **Pasos:** crear fase "Fase 1" y subfase "Subfase 1.1" (bajo Fase 1, presupuesto S/5,000); agregar actividad "Actividad X" en Fase 1 con equipo asignado (EQ-00001).
- **Resultado esperado:** código jerárquico "1.1" para la subfase; equipo visible en la columna correspondiente de la actividad.
- **Resultado obtenido:** exacto. (No había empleados `ACTIVO` sembrados para probar `responsableId` — mismo patrón de `<select>` que `equipoId`, sin lógica adicional que distinga ambos casos.)

## Escenario 7 — Validaciones de formularios con datos inválidos
- **Pasos:** proyecto con `fechaFinPlan` anterior a `fechaInicioPlan`; actividad con `duracionDias = 0` (bypaseando el `min` HTML); costo con `monto = 0`; precedencia duplicada (misma predecesora/sucesora dos veces).
- **Resultado esperado:** cada uno rechazado con su mensaje específico, sin crear el registro.
- **Resultado obtenido:** exacto en los 4 casos — "La fecha de fin planificada no puede ser anterior al inicio.", "La duración (días) debe ser un entero mayor a 0.", "El monto debe ser mayor a 0.", "Esa precedencia ya existe."

## Escenario 8 — Eliminar precedencia y recalcular
- **Pasos:** con precedencia X→Y activa (X crítica holgura 0, Y crítica holgura 0), eliminar la precedencia.
- **Resultado esperado:** ambas actividades vuelven a ser independientes; la ruta crítica se recalcula sola (X vuelve a holgura 0 por ser la más larga, Y pasa a tener holgura > 0 si es más corta que el tramo más largo).
- **Resultado obtenido:** exacto — Y pasó a holgura 1 día (proyecto más largo determinado por X, de 4 días vs. Y de 3 días).

## Escenario 9 — Eliminar actividad sin dependientes (camino feliz)
- **Pasos:** tras quitar la precedencia del escenario 8, eliminar Actividad X (ya sin sucesores dependientes).
- **Resultado esperado:** se elimina sin bloqueo; la ruta crítica se recalcula con la actividad restante.
- **Resultado obtenido:** exacto.

## Escenario 10 — Cambio de estado y timestamps reales
- **Pasos:** proyecto `PLANIFICADO` → `EN_PROGRESO` → `CERRADO` (dos cambios de estado sucesivos), verificado por SQL directo.
- **Resultado esperado:** `fechaInicioReal` se fija en la primera transición a `EN_PROGRESO` y no se vuelve a tocar; `fechaFinReal` se fija al llegar a `CERRADO`.
- **Resultado obtenido:** exacto — timestamps confirmados por consulta SQL directa, sin sobrescritura del primero.

## Escenario 11 — Proyecto cerrado desaparece del selector de OC; `edtId` se persiste
- **Pasos:** con el proyecto `CERRADO`, abrir `/logistica/ordenes-compra/nuevo` (el selector de proyecto no debe aparecer); reabrir a `EN_PROGRESO` y crear una OC etiquetada a la subfase "1.1 — Subfase 1.1" específicamente (no solo al proyecto).
- **Resultado esperado:** el selector de proyecto se oculta por completo mientras está `CERRADO` (la fuente solo trae `PLANIFICADO`/`EN_PROGRESO`); al reabrir, la OC guarda tanto `proyectoId` como `edtId` correctos.
- **Resultado obtenido:** exacto, confirmado por SQL directo sobre `ordenes_compra`.

## `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios (`seed-demo.ts`, `comercial/cotizaciones/page.tsx`, `configuracion/almacenes/actions.ts`, `finanzas/activos-fijos/page.tsx`, `logistica/inspeccion-compras/page.tsx`, `produccion/mantenimiento/page.tsx`) — confirmado que ningún archivo nuevo de este cambio introduce errores.

## Datos de prueba a limpiar
- Ronda 1: proyecto `PRY-00001` (con sus fases, actividades, precedencias, costos), `OC-00003` y `AF-00001` insertados vía UI real, eliminados por SQL directo (`better-sqlite3` sobre `dev.db`) tras la verificación. Confirmado post-limpieza: `/proyectos` y `/finanzas/activos-fijos` vuelven a "Sin registros".
- Ronda 2 (escenarios 6-11, cobertura adicional): un segundo proyecto `PRY-00001` (código reiniciado tras el borrado anterior) con fase, subfase, actividad y una OC de S/500 etiquetada a la subfase, eliminados por el mismo método. Confirmado post-limpieza: recuento en cero en las 5 tablas del módulo (`proyectos`, `edt_proyecto`, `actividades_proyecto`, `precedencias_actividad`, `costos_proyecto`) y ninguna `OrdenCompra` con `proyectoId` no nulo.
