# SQL — Modelo de datos — configuracion-usuarios

Sin cambios de schema. Se reutiliza `Sesion` (ya existente, con `usuarioId` y `creadoEn`) y
`Usuario.creadoEn` (ya existente). No se agregó una tabla de auditoría — el dato ya estaba
capturado, solo no se mostraba en ningún reporte.

## Migración
- Ninguna.
