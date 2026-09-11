# Integridad FK de empresa: configuración y contabilidad general

La séptima etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en los maestros de configuración (almacenes, clases de unidad de medida, grupos de seguridad) y en el núcleo contable (periodos fiscales, planes de cuentas, libros, asientos contables y controles contables).

Las ocho relaciones usan `onDelete: Restrict`: ninguna compañía con almacenes operativos, grupos de permisos vigentes o contabilidad registrada puede borrarse dejando maestros o asientos huérfanos. La migración reconstruye únicamente esas ocho tablas y conserva sus datos, índices y relaciones existentes; las demás tablas que apuntan a `almacenes` mantienen sus claves foráneas.

La suite aplica la cadena completa sobre SQLite efímero, ejecuta los flujos críticos de inventario y contabilización, y comprueba que ni un almacén ni un libro contable puedan referenciar una compañía inexistente.
