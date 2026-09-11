# Integridad FK de empresa: tesorería, rutas y series de documento

La sexta etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en los movimientos de caja, las conciliaciones bancarias, las hojas de ruta de despacho y las series de documento.

Las cuatro relaciones usan `onDelete: Restrict` para que ninguna compañía con tesorería, rutas o correlativos emitidos pueda borrarse y dejar movimientos huérfanos. La migración reconstruye únicamente esas cuatro tablas y conserva sus datos, índices y relaciones existentes.

La suite aplica la cadena completa sobre SQLite efímero, ejecuta los flujos críticos de caja y facturación, y comprueba que ni un movimiento de caja ni una serie de documento puedan referenciar una compañía inexistente.
