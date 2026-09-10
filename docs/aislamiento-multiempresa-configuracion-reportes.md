# Aislamiento multiempresa de configuración y reportes

Este bloque aplica la empresa activa a configuraciones contables y de compras, además de la valorización histórica de inventario.

## Alcance

- El calendario fiscal genera, lista, cierra y reabre períodos únicamente en la empresa activa.
- Los niveles de aprobación de compras se crean, listan y desactivan dentro de la empresa activa.
- La valorización de inventario consulta movimientos y almacenes de la empresa activa, incluso cuando se recibe un filtro de almacén por URL.

Estas protecciones cubren tanto la interfaz como las acciones de servidor para impedir que identificadores pertenecientes a otra empresa modifiquen la configuración seleccionada.
