# UI — Pantallas — configuracion-sod

## `/configuracion/grupos-seguridad`

- Las casillas son controladas y aplican actualización optimista.
- Ante rechazo, recuperan el valor previo y muestran `código: explicación` mediante `role="alert"`, `aria-invalid` y `aria-describedby`.
- Cada grupo personalizado muestra un resumen verde sin conflictos o una lista roja de conflictos existentes.
- Los grupos predefinidos continúan bloqueados y no reciben un diagnóstico engañoso.
