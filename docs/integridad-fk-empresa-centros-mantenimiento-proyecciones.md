# Integridad FK de empresa: centros de trabajo, mantenimiento y proyecciones

La novena etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en los centros de trabajo, los equipos, los avisos y planes de mantenimiento, y las proyecciones trimestrales.

Las cinco relaciones usan `onDelete: Restrict`: el padrón técnico y su historial de mantenimiento son trazabilidad de activos que no puede quedar huérfana. La migración reconstruye únicamente esas cinco tablas y conserva sus datos, índices y relaciones existentes.

Al redefinir `equipos` desaparece además `equipos_centroTrabajoId_idx`, un índice que quedó en la base pero que el esquema ya no declara; la reconstrucción de la tabla lo alinea con `schema.prisma` sin tocar datos.

La suite aplica la cadena completa sobre SQLite efímero, ejecuta los flujos críticos de mantenimiento y proyecciones, y comprueba que una proyección no pueda referenciar una compañía inexistente.
