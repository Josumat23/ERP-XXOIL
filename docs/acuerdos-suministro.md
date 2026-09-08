# Acuerdos marco de suministro

Un acuerdo fija proveedor, vigencia, moneda/tipo de cambio y cantidades/precios por material. Desde su detalle se realizan liberaciones parciales que generan órdenes de compra al precio contractual.

La transacción reserva el saldo de cada línea con control de concurrencia, impide exceder la cantidad comprometida y crea la OC con referencias al acuerdo y sus posiciones. La nueva OC conserva el flujo de aprobación multinivel por monto. Proveedores, materiales, contratos y órdenes permanecen aislados por empresa.
