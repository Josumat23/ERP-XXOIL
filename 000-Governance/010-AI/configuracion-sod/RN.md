# RN — Reglas de negocio — configuracion-sod

| ID | Regla |
|---|---|
| RN-SOD-001 | En `materiales`, `finanzas`, `ventas` y `rrhh`, un grupo personalizado no puede tener `puedeAprobar` junto con `puedeCrear` o `puedeEditar`. |
| RN-SOD-002 | La evaluación usa el grupo completo releído por el servidor dentro de la misma transacción que persiste el cambio. |
| RN-SOD-003 | Los grupos inexistentes y predefinidos se rechazan; los predefinidos no se presentan como conflictivos porque son inmutables y modelan roles base. |
| RN-SOD-004 | Solo los cambios aceptados generan auditoría de maestro. |
