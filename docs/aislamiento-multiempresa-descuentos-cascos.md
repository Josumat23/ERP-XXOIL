# Aislamiento multiempresa de descuentos y cascos

## Migración

- `DescuentoCanal` incorpora `empresaId` y cambia la unicidad global de `canal` por `(empresaId, canal)`.
- `MovimientoCasco` incorpora `empresaId` y un índice por compañía, cliente e insumo.
- Las filas históricas se asignan a la empresa principal (`1`) durante la migración.

## Aplicación

- Cada empresa mantiene sus propios porcentajes de descuento por canal.
- La resolución del precio de pedido y los formularios de pedidos/cotizaciones consumen solo los descuentos de la empresa activa.
- El ledger de cascos valida cliente e insumo contra la misma compañía, calcula saldos sin cruzar empresas y guarda `empresaId` explícitamente.
