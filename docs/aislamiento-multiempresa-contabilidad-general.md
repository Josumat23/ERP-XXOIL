# Aislamiento multiempresa de contabilidad general

Este bloque aplica la empresa activa a la configuración y consulta del libro mayor.

## Alcance

- Planes y cuentas contables, incluida la activación de cuentas.
- Controles contables utilizados por los posteos automáticos.
- Períodos fiscales, libro diario y asientos manuales o de reverso.
- Listado y detalle de asientos, balance de comprobación y resúmenes PLE.
- Descargas PLE de ventas y compras.
- Propagación de la empresa de origen en posteos automáticos de ventas, cobranzas, compras, pagos, producción, mantenimiento, planilla, créditos y despachos.

## Garantías

- Una cuenta seleccionada debe pertenecer al plan de la empresa activa.
- Un asiento manual o su reverso no puede leer ni modificar asientos de otra empresa.
- El motor resuelve controles, centros de costo, presupuesto, período y libro dentro de la empresa indicada por la transacción.
- La numeración de asientos sigue siendo global porque el esquema actual conserva `AsientoContable.numero` como clave única global.
- Las exportaciones PLE incluyen únicamente documentos de la empresa activa.
