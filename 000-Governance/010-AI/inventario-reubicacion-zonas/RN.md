# RN — Reglas de negocio — inventario-reubicacion-zonas

| ID | Regla | Por qué |
|---|---|---|
| RN-REUB-001 | La zona destino debe pertenecer al mismo `almacenId` que la zona actual del ítem. Si el ítem no tiene zona asignada (`zonaAlmacenId = null`), se permite asignar cualquier zona (primera ubicación). | Evitar que "reubicar" se use accidentalmente como un traslado real entre almacenes, que tiene una semántica distinta (mueve cantidad de stock, valida disponibilidad) y ya tiene su propio flujo arriba en la misma página. |
| RN-REUB-002 | No se permite "reubicar" a la misma zona en la que ya está (rechazado con mensaje explícito). | Evitar una actualización sin efecto que confunda si algo pasó o no. |
| RN-REUB-003 | La reubicación NO genera `MovimientoKardex` ni afecta `SaldoAlmacen` — solo actualiza el campo `zonaAlmacenId` del ítem. | No hay cantidad que mover: es un cambio de ubicación estructurada de un ítem que ya tiene una sola instancia lógica de stock (a diferencia de SAP WM/EWM, que sí particiona cantidad por bin). |

## Casos borde considerados
- Ítem sin zona asignada todavía (primera asignación, sin restricción de almacén origen).
- Zona destino de un almacén distinto al actual (rechazado con mensaje que redirige al flujo correcto).
- Reubicar a la misma zona actual (rechazado).
