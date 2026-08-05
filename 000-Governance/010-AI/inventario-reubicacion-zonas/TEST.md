# TEST — Verificación — inventario-reubicacion-zonas

## Escenario 1 — Reubicación válida dentro del mismo almacén
- **Datos:** `GR-CHASIS-POTE-1LB` sin zona asignada; destino "Planta de producción / A-01".
- **Pasos:** seleccionar ítem y zona, confirmar "Reubicar".
- **Resultado esperado:** mensaje "Ítem reubicado."; el selector de ítem refleja "(hoy: Planta de producción / A-01)".
- **Resultado obtenido:** exacto a lo esperado.

## Escenario 2 — Bloqueo al reubicar a otro almacén
- **Datos:** zona sintética `B-01` creada por SQL en "Almacén Trujillo"; mismo ítem del escenario 1 (ya en A-01 de Planta de producción).
- **Pasos:** intentar reubicar a la zona de Trujillo.
- **Resultado esperado:** error "La zona destino pertenece a otro almacén — para eso use el traslado entre almacenes de arriba, no la reubicación de zona." Sin cambios aplicados (el ítem sigue en A-01).
- **Resultado obtenido:** exacto a lo esperado.

## `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios.

## Datos de prueba a limpiar
- `zonaAlmacenId` de `GR-CHASIS-POTE-1LB` revertido a `NULL` (estado original).
- Zona sintética `B-01` (Almacén Trujillo) eliminada por SQL. Confirmado post-limpieza: solo quedan las 3 zonas reales (A-01, ENV-01, MP-01).
