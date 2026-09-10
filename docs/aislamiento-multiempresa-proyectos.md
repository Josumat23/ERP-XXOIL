# Aislamiento multiempresa de proyectos

Este bloque limita los proyectos de inversión, su WBS, actividades, precedencias y costos a la empresa activa.

Las páginas muestran únicamente proyectos, centros de costo, empleados y equipos de la compañía seleccionada. Cada Server Action vuelve a autenticar al usuario y valida que el proyecto y todas las dimensiones recibidas desde el formulario pertenezcan a esa misma empresa antes de leer o modificar información.

Los códigos `PRY-00001` se numeran independientemente por empresa. La migración reemplaza el índice único global por una restricción compuesta `(empresaId, codigo)` sin modificar los proyectos existentes.

## Verificación

- Prisma valida el esquema y genera el cliente.
- La suite comprueba que dos empresas pueden usar el mismo código inicial sin colisión.
- TypeScript, lint, `git diff --check` y build de producción completan la validación del bloque.
