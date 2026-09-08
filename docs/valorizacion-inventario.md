# Valorización de inventario a fecha de corte

Cada movimiento nuevo del kardex congela el costo promedio vigente después del movimiento. El reporte toma, para cada artículo y almacén, el último saldo y costo registrado hasta las 23:59:59 de la fecha seleccionada.

El valor se expresa en PEN y se calcula como `saldo × costo congelado`. Los movimientos históricos anteriores a esta implantación mantienen costo cero; el reporte los identifica como “sin snapshot” y no aplica el costo actual retroactivamente, porque eso falsearía un cierre pasado.

Ruta: `/inventario/valorizacion`. Admite filtro por fecha y almacén y respeta la empresa activa.
