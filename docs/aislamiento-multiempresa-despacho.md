# Aislamiento multiempresa del despacho

## Alcance entregado

- Guías de remisión: listado, alta, detalle, salida, entrega, anulación y reenvío electrónico.
- Validación de cliente, pedido, factura, presentaciones, equipo y serie legal contra la empresa activa.
- Backlog, comisiones y devoluciones de clientes filtrados por compañía.
- Series legales protegidas contra selección o avance desde otra empresa.
- Comprobantes electrónicos registrados con la compañía real de la factura, nota de crédito o guía.

## Límite pendiente

`DescuentoCanal` y `MovimientoCasco` todavía no contienen `empresaId` en el esquema. Su separación real requiere una migración de datos y se aborda como bloque independiente para no simular aislamiento únicamente en la interfaz.
