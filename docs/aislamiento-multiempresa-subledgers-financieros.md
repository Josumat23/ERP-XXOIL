# Aislamiento multiempresa de subledgers financieros

## Operaciones protegidas

- Registro, aprobación y rechazo de pagos a proveedores.
- Liberación de facturas de proveedor con discrepancias.
- Propuestas de pago en lote.
- Movimientos manuales y automáticos de caja.
- Compensaciones y reembolsos de saldos a favor de clientes y proveedores.

El motor compartido de pagos exige `empresaId`, lo valida al reclamar la CxP y lo propaga al pago, al movimiento de caja y a la actualización del saldo.

## Consultas protegidas

- Cuentas por cobrar y pagar.
- Libro de caja y totales acumulados.
- Saldos a favor de clientes y proveedores.
- Costos y márgenes, rentabilidad y estado de resultados.

Todos los totales y comparativos se calculan únicamente con registros de la empresa activa.
