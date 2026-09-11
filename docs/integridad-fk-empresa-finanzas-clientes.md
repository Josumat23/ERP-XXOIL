# Integridad FK de empresa: finanzas de clientes

La cuarta etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en avisos de cobranza, comprobantes electrónicos, cobros, notas de crédito, créditos de cliente, aplicaciones, reembolsos, devoluciones y comisiones.

Las nueve relaciones usan `onDelete: Restrict` para conservar la trazabilidad financiera y fiscal. La migración reconstruye exclusivamente esas nueve tablas, preservando datos, índices y relaciones existentes.

La suite aplica toda la cadena de migraciones sobre SQLite efímero y ejecuta los flujos de venta, cobro, reversa, crédito, reembolso, devolución y contabilización.
