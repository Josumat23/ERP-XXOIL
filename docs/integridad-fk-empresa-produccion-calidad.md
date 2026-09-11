# Integridad FK de empresa: producción y calidad

La segunda etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en fórmulas, lotes a granel, envasados, no conformidades, planes de inspección, causas de calidad y reclamos de clientes.

Las siete relaciones usan `onDelete: Restrict` para impedir que una compañía con trazabilidad productiva o de calidad sea eliminada dejando historia huérfana. La migración de SQLite reconstruye exclusivamente esas siete tablas y conserva sus datos, índices y relaciones existentes.

La suite aplica la cadena completa de migraciones sobre una base efímera, ejecuta el flujo integrado de producción/calidad/envasado y comprueba que una causa de calidad no pueda referenciar una compañía inexistente.
