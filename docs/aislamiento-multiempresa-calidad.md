# Aislamiento multiempresa de calidad

Este bloque aplica la empresa activa al control de calidad interno y a los reclamos de clientes.

- Los lotes pendientes, evaluaciones, planes y causas se consultan únicamente dentro de la empresa activa.
- El catálogo de causas se crea, lista y activa o desactiva por compañía.
- Los reclamos, clientes y facturas seleccionables se filtran por empresa.
- La creación y actualización vuelve a validar en el servidor la pertenencia del cliente, factura, causa, lote y reclamo.
- Las no conformidades generadas conservan la empresa del lote evaluado.

`ControlCalidad` no contiene `empresaId`; su aislamiento se obtiene mediante su relación obligatoria con `LoteGranel`, que sí pertenece a una empresa.
