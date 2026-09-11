# Integridad FK de empresa: núcleo comercial

La tercera etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en zonas, vendedores, descuentos por canal, clientes, cotizaciones, pedidos y facturas.

Las siete relaciones restringen la eliminación de compañías que tengan historia comercial. La migración conserva los datos, índices y relaciones existentes y reconstruye exclusivamente las tablas de este dominio.

La suite aplica toda la cadena de migraciones sobre SQLite efímero, recorre los flujos críticos de venta y verifica que una zona no pueda vincularse a una compañía inexistente.
