# Integridad FK de empresa: RR. HH., asistencia, planilla y adjuntos

La décima etapa del ítem 0.2 incorpora relaciones físicas hacia `Empresa` en empleados, turnos de trabajo, registros de asistencia, parámetros de planilla, políticas de tiempo de trabajo, periodos de planilla y adjuntos.

Las siete relaciones usan `onDelete: Restrict`: el legajo laboral, la asistencia aprobada y la planilla cerrada son historia que no puede quedar huérfana, y los adjuntos apuntan a documentos físicos que siguen en disco.

Con esta etapa los 76 modelos que llevan `empresaId` tienen relación física hacia `Empresa`.

Al redefinir `empleados` se normaliza además la clave foránea `jefeDirectoId`, que se había agregado con `ALTER TABLE ... ADD COLUMN` y quedó sin `ON UPDATE CASCADE`; la reconstrucción la alinea con la forma canónica que emite Prisma, sin tocar datos ni cambiar el comportamiento de borrado (`ON DELETE SET NULL`).

La suite aplica la cadena completa sobre SQLite efímero, ejecuta los flujos críticos de asistencia y planilla, y comprueba que ni un turno de trabajo ni un adjunto puedan referenciar una compañía inexistente.
