# Aislamiento multiempresa de facturación y rutas

## Alcance

- Facturas y su detalle solo se consultan desde la empresa activa.
- Cobros, notas de crédito, anulaciones, devoluciones, recargos y reenvíos electrónicos validan la compañía del documento antes de mutarlo.
- La cobranza vencida y el bloqueo de clientes quedan limitados a la empresa activa.
- Las hojas de ruta validan vendedor y clientes, guardan `empresaId` explícitamente y aíslan listado, detalle y cierre.

## Control aplicado

La empresa activa se obtiene en el servidor. Los identificadores recibidos desde formularios o URLs nunca se consideran autorización suficiente: cada lectura o actualización comprueba `empresaId`, y las entidades relacionadas seleccionables también deben pertenecer a la misma compañía.
