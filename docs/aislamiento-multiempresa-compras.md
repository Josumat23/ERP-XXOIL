# Aislamiento multiempresa de compras

## Alcance

- Listados, altas y detalles de órdenes de compra se resuelven en la empresa activa.
- La creación valida proveedor, almacén, insumos, proyecto y fase antes de registrar la orden.
- Anulación, aprobación, rechazo y recepción rechazan identificadores pertenecientes a otra compañía.
- Recepciones, cuentas por pagar y devoluciones guardan explícitamente el `empresaId` de la orden.
- Las bandejas y fichas de inspección siguen la compañía activa a través de la recepción y la orden origen.
- Las acciones y listados principales de RFQ usan la empresa activa, incluida la adjudicación y la OC generada.

## Integridad

La compañía se obtiene en el servidor y no desde campos editables del formulario. Las relaciones sin `empresaId` propio se validan atravesando su documento raíz.
