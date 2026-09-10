# Aislamiento multiempresa de envasado y capacidad

El envasado y la planificación de capacidad operan dentro de la empresa activa.

- Los listados, detalles y formularios de envasado solo muestran lotes, presentaciones, envases y etiquetas de la compañía activa.
- La acción de envasado valida nuevamente lote, presentación e insumos antes de reservar granel o mover inventario.
- La reserva concurrente del lote incluye `empresaId` en su condición.
- La planificación de capacidad carga únicamente centros y órdenes abiertas de la empresa activa.
- Las operaciones que reciben fechas provienen exclusivamente del conjunto previamente aislado.

`Envasado` y `LoteOperacion` no tienen `empresaId` propio; su ámbito se obtiene mediante la relación obligatoria con `LoteGranel`.
