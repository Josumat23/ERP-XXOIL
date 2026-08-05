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

## `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios (`seed-demo.ts`, `comercial/cotizaciones/page.tsx`, `configuracion/almacenes/actions.ts`, `finanzas/activos-fijos/page.tsx`, `logistica/inspeccion-compras/page.tsx`, `produccion/mantenimiento/page.tsx`) — confirmado que ningún archivo nuevo de este cambio introduce errores.

## Datos de prueba a limpiar
- Proyecto `PRY-00001` (con sus fases, actividades, precedencias, costos), `OC-00003` y `AF-00001` insertados vía UI real, eliminados por SQL directo (`better-sqlite3` sobre `dev.db`) tras la verificación. Confirmado post-limpieza: `/proyectos` y `/finanzas/activos-fijos` vuelven a "Sin registros".
