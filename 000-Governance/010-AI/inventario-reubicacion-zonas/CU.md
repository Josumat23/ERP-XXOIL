# CU — Casos de uso — inventario-reubicacion-zonas

## CU-REUB-001 — Reubicar un ítem a otra zona del mismo almacén
- **Actor:** ALMACEN, ADMIN
- **Precondición:** existen al menos 2 zonas activas en el almacén donde vive el ítem (o el ítem no tiene zona asignada).
- **Flujo principal:**
  1. En `/inventario/traslados`, sección "Reubicar entre zonas del mismo almacén".
  2. Selecciona el ítem (presentación o insumo) — el desplegable muestra su zona actual entre paréntesis.
  3. Selecciona la zona destino.
  4. Confirma "Reubicar".
- **Postcondición:** el ítem queda con la nueva `zonaAlmacenId`; el desplegable refleja el cambio de inmediato.

## CU-REUB-002 — Intento de reubicar a otro almacén (bloqueado)
- **Actor:** ALMACEN, ADMIN
- **Flujo:** selecciona una zona que pertenece a un almacén distinto al actual del ítem.
- **Resultado:** error explícito indicando que debe usar el traslado entre almacenes de arriba en su lugar. No se aplica ningún cambio.
