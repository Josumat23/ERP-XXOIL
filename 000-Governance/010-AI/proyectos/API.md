# API — Server actions — proyectos

Todas en `src/app/(app)/proyectos/actions.ts` salvo donde se indique. Todas requieren `requerirRol(["GERENCIA"])` + `puedeRealizar(usuario, "proyectos", "crear"|"editar")`.

## `crearProyecto(prevState, formData)`
- Valida nombre, presupuesto > 0, fechaFinPlan >= fechaInicioPlan.
- Genera código vía `siguienteCodigoProyecto` (`src/lib/correlativos.ts`, prefijo `PRY`).
- Redirige a `/proyectos/[id]`.

## `cambiarEstadoProyecto(id, nuevoEstado)`
- Sin `formData` (invocada desde un formulario inline con `action(formData) => ...` en el server component). Setea `fechaInicioReal`/`fechaFinReal` la primera vez que el proyecto entra a EN_PROGRESO/CERRADO.

## `crearEdt(proyectoId, prevState, formData)`
- Calcula el código jerárquico contando hermanos bajo el mismo `parentId` (o nivel raíz).
- `presupuesto` es opcional e informativo.

## `crearActividad(edtId, prevState, formData)`
- Código `A-01`, `A-02`... contando actividades existentes en el EDT.
- Tras crear, llama `recalcularRutaCritica(tx, proyectoId)` (`src/lib/proyectos.ts`).

## `eliminarActividad(proyectoId, id)`
- Rechaza (silenciosamente, best-effort) si la actividad tiene sucesoras dependientes. Si procede, borra sus precedencias entrantes, la actividad, y recalcula la ruta.

## `crearPrecedencia(proyectoId, prevState, formData)`
- Valida que ambas actividades pertenezcan al proyecto, que no sea auto-referencia, y que no forme ciclo (`formariaCiclo`, DFS). Recalcula la ruta al insertar.

## `eliminarPrecedencia(proyectoId, id)`
- Borra la arista y recalcula.

## `agregarCostoProyecto(proyectoId, prevState, formData)`
- Crea una fila `CostoProyecto`. No actualiza ningún campo acumulado — el costo real se calcula al vuelo (ver `costoRealProyecto`).

## `src/lib/proyectos.ts` (no son server actions, funciones de librería)
- `recalcularRutaCritica(tx, proyectoId)` — CPM: forward pass (ES/EF) + backward pass (LS/LF) por orden topológico (Kahn), holgura = LS − ES, crítica si holgura = 0. Escribe `fechaInicioPlan`/`fechaFinPlan`/`esCritica`/`holguraDias` en cada `ActividadProyecto`.
- `formariaCiclo(tx, predecesoraId, sucesoraId)` — DFS desde la sucesora por las aristas existentes; si alcanza a la predecesora, el nuevo arco cerraría un ciclo.
- `costoRealProyecto(tx, proyectoId)` — `CostoProyecto._sum.monto` + `OrdenCompra` (estado != ANULADA) convertidas a PEN con `convertirAPen`.

## Extensiones a módulos existentes
- `src/app/(app)/logistica/ordenes-compra/actions.ts` — `crearOrdenCompraDesdeDatos` y `crearOrdenCompra` aceptan `proyectoId`/`edtId` opcionales.
- `src/app/(app)/finanzas/activos-fijos/actions.ts` — `crearActivoFijo` acepta `proyectoId` opcional (llega vía query string desde el link "Capitalizar").
