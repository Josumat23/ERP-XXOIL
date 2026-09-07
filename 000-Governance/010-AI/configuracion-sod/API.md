# API — Server Actions — configuracion-sod

`actualizarPermiso(permisoId, campo, valor)` devuelve una unión discriminada:

- `{ ok: true }` si guardó y auditó el cambio.
- `{ ok: false, codigo, mensaje }` para autenticación rechazada, entrada inválida, permiso inexistente, grupo predefinido o conflicto SoD.

El identificador aportado por el cliente solo localiza el permiso. El servidor relee el permiso, su grupo y todos sus permisos dentro de `prisma.$transaction`; después construye el estado propuesto, evalúa la matriz y recién entonces actualiza.
