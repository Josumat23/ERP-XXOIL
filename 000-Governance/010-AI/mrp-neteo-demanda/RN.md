# RN — Neteo de demanda MRP

- `demandaPlanificada = max(pronóstico, pedidosFirmesPendientes)`: los pedidos consumen el pronóstico; solo el exceso de backlog lo incrementa.
- La necesidad es `max(0, demandaPlanificada + stockMínimo - stockFísico)`. No se resta además `stockReservado`, porque esas mismas unidades ya están representadas por pedidos firmes y hacerlo duplicaría su efecto.
- En pedidos parciales se resta lo ya facturado mediante `FacturaDetalle`; las facturas anuladas no consumen cantidad.
- Se incluyen pedidos con entrega anterior al fin del trimestre, incluidos vencidos o sin fecha. Se excluyen pedidos de otra compañía y entregas posteriores.
