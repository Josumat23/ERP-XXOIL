# Aislamiento multiempresa de centros de trabajo y equipos

Los centros de trabajo y equipos se administran exclusivamente dentro de la empresa activa.

- Listados, detalles y formularios filtran almacenes, centros de costo, activos fijos, centros de trabajo y equipos por compañía.
- Las altas escriben `empresaId` explícitamente.
- Crear o actualizar un centro valida que planta y centro de costo pertenezcan a la empresa activa.
- Crear un equipo valida almacén, activo fijo, centro de costo y centro de trabajo en el servidor.
- Activaciones y lecturas de contador exigen que el equipo pertenezca a la empresa activa.
- Los planes preventivos se crean y activan únicamente a través de un equipo de la compañía activa.

Las lecturas y planes no duplican `empresaId`; heredan el ámbito mediante su relación obligatoria con `Equipo`.
