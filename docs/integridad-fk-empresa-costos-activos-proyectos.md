# Integridad FK de empresa: costos, activos fijos y proyectos

La octava etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en los centros de costo, las órdenes internas, los controles de centro de costo, los activos fijos y los proyectos.

Las cinco relaciones usan `onDelete: Restrict`: la jerarquía de costos, el inventario de activos capitalizados y la cartera de proyectos son historia contable que no puede quedar huérfana si se intenta borrar una compañía. La migración reconstruye únicamente esas cinco tablas y conserva sus datos, índices y relaciones existentes, incluida la jerarquía autorreferenciada de `centros_costo`.

La suite aplica la cadena completa sobre SQLite efímero, ejecuta los flujos críticos de costos y proyectos, y comprueba que ni un centro de costo ni un proyecto puedan referenciar una compañía inexistente.
