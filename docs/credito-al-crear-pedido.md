# Verificación de crédito al crear el pedido

El control de crédito ya existía completo —evaluación de deuda contra límite, estados de aprobación, bandeja para gerencia—, pero corría dentro de `facturarPedido`. Un pedido que llevaba al cliente por encima de su límite nacía como cualquier otro: **reservaba stock y comprometía la entrega frente al cliente**, y el problema aparecía recién al facturar, cuando revertirlo ya cuesta caro.

## Qué cambia

`crearPedido` evalúa el crédito antes de insertar el pedido:

- Si la condición es `CONTADO`, no consume límite y no se evalúa nada.
- Si el cliente tiene límite y la deuda pendiente más este pedido lo superan, el pedido nace con `estadoAprobacionCredito: PENDIENTE` y la instantánea de la evaluación (deuda, monto y límite del momento).
- Aparece en la bandeja de aprobaciones (`/aprobaciones`) desde el primer momento, que ya filtraba por `estado: PENDIENTE` + `estadoAprobacionCredito: PENDIENTE`.

El monto se convierte a moneda funcional con `calcularImportesFuncionales`, igual que en la facturación: un pedido en dólares no puede compararse con un límite en soles sin convertir.

## Por qué el bloqueo duro sigue en la facturación

La evaluación de hoy no autoriza la factura de mañana. Entre crear el pedido y facturarlo el cliente pudo pagar sus facturas vencidas o endeudarse más, así que `facturarPedido` reevalúa con la deuda del momento y `esAprobacionCreditoVigente` exige que la aprobación guardada corresponda exactamente a la misma condición de pago, deuda, monto y límite. Una aprobación dada sobre otros números no sirve.

Dicho de otro modo: la evaluación al crear **adelanta la conversación**, no reemplaza el control.

## Hallazgo colateral: la bandeja no filtraba por compañía

`/aprobaciones` listaba los pedidos, órdenes de compra y pagos pendientes de **todas** las compañías. Es una pantalla de rol ADMIN/GERENCIA, pero el rol no es la compañía. Las tres consultas pasan a filtrar por la compañía activa.

Se encontró justamente porque este cambio enruta más pedidos hacia esa bandeja. La guardia de pantallas que ya existía no lo detectaba: solo busca pantallas que usan `usuario.empresaId` sin resolver la compañía activa, y esta no filtraba por compañía en absoluto. Queda cubierta por una prueba propia.

## Verificación

La aritmética de la evaluación ya estaba cubierta por `evaluarCredito`. Las pruebas nuevas fijan **dónde** ocurre: que `crearPedido` evalúe y marque `PENDIENTE`, que `CONTADO` no consuma límite, que `facturarPedido` conserve su reevaluación, y que las tres consultas de la bandeja estén acotadas.
