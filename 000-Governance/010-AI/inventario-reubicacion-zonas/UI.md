# UI — Pantallas — inventario-reubicacion-zonas

## `/inventario/traslados`
- Nueva sección "Reubicar entre zonas del mismo almacén", debajo del formulario de traslado
  existente entre almacenes.
- Explica en una línea la diferencia con el traslado de arriba (cantidad de stock vs. ubicación).
- Selector de ítem muestra la zona actual entre paréntesis ("hoy: Almacén / Zona") o
  "(sin zona asignada)".
- Selector de zona destino lista todas las zonas activas de todos los almacenes, formateadas
  "Almacén / Código — Nombre".
- Si no hay ninguna `ZonaAlmacen` activa, se muestra un aviso en vez del formulario.
- Mensaje de error inline si la zona destino pertenece a otro almacén, o de confirmación si se
  aplicó.
