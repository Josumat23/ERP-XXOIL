# SQL — Modelo de datos — proyectos

## Modelos nuevos (migración `20260805030347_proyectos_ps_reducido`)

- **`Proyecto`** — cabecera: `codigo` (PRY-00001), `nombre`, `descripcion?`, `centroCostoId?` (informativo), `presupuestoTotal`, `estado` (`EstadoProyecto`), `fechaInicioPlan`, `fechaFinPlan`, `fechaInicioReal?`, `fechaFinReal?`, `responsableId?` (→ `Empleado`).
- **`EdtProyecto`** — nodo de WBS: `proyectoId`, `parentId?` (auto-relación `EdtJerarquia`, árbol multinivel), `codigo` (jerárquico, calculado en el server action), `nombre`, `presupuesto?`, `orden`.
- **`ActividadProyecto`** — nodo de red: `edtId`, `codigo` (`A-01`...), `nombre`, `duracionDias`, `estado`, `responsableId?` (→ `Empleado`), `equipoId?` (→ `Equipo`), y 4 campos calculados por CPM (`fechaInicioPlan?`, `fechaFinPlan?`, `esCritica`, `holguraDias`) — nunca editados a mano.
- **`PrecedenciaActividad`** — arista: `actividadPredecesoraId`, `actividadSucesoraId`, `@@unique` sobre el par.
- **`CostoProyecto`** — ledger de costos reales: `proyectoId`, `edtId?`, `concepto`, `monto`, `fecha`, auditoría — mismo patrón que `OrdenInternaCosto`.

## Enum nuevo
- `EstadoProyecto`: `PLANIFICADO` | `EN_PROGRESO` | `CERRADO` | `CANCELADO` (reutilizado también como estado de `ActividadProyecto`, aunque en la práctica una actividad no pasa por todos los mismos valores).

## FKs opcionales agregadas a modelos existentes
- `OrdenCompra.proyectoId?` + `OrdenCompra.edtId?` — etiqueta de costeo, sin cambiar ninguna restricción existente.
- `ActivoFijo.proyectoId?` — trazabilidad de origen; no participa en el cálculo de depreciación.

## Por qué no un campo `totalAcumulado` en `Proyecto`
A diferencia de `OrdenInterna.totalAcumulado` (que sí se persiste porque solo tiene una fuente, `OrdenInternaCosto`), el costo real de un `Proyecto` tiene dos fuentes (`CostoProyecto` + `OrdenCompra`). Persistir un acumulado exigiría mantenerlo sincronizado desde dos flujos distintos (incluida la posible anulación de una OC ya contada) — se optó por calcularlo al vuelo (`costoRealProyecto`) para eliminar esa clase de bug, al costo de una query adicional en cada vista. Ver `RN-PRY-005`.

## Índices / relaciones reutilizadas sin cambios
- `Empleado.proyectosResponsable` / `Empleado.actividadesResponsable` — relaciones inversas agregadas para no romper el tipo de `Empleado` existente.
- `Equipo.actividadesProyecto` — ídem.
- `CentroCosto.proyectos` — ídem, uso puramente informativo (ver `RN-PRY-004`).
