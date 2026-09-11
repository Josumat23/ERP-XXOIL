# Integridad FK de empresa: compras y proveedores

La quinta etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en acuerdos de suministro, RFQ, órdenes y niveles de aprobación de compra, recepciones, devoluciones, inspecciones, guías, cuentas por pagar, pagos y créditos, aplicaciones y reembolsos de proveedor.

Las trece relaciones usan `onDelete: Restrict` para preservar trazabilidad logística, financiera y de aprobación. La migración reconstruye únicamente esas trece tablas y conserva sus datos, índices y relaciones existentes.

La suite aplica la cadena completa sobre SQLite efímero, ejecuta los flujos críticos procure-to-pay y comprueba que un nivel de aprobación no pueda referenciar una compañía inexistente.
