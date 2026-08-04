# RN — Reglas de negocio — configuracion-usuarios

| ID | Regla | Por qué |
|---|---|---|
| RN-USR-001 | La "última conexión" es la fecha de creación (`Sesion.creadoEn`) más reciente entre todas las sesiones del usuario — no se distingue sesión expirada de sesión activa, porque para revisión de accesos importa cuándo entró la última vez, no si el token técnicamente sigue vivo. | Simplicidad: no se necesita una tabla de auditoría nueva, `Sesion` ya tiene el dato. |
| RN-USR-002 | Umbral de alerta: 90 días. Para una cuenta que nunca inició sesión, se cuenta desde `Usuario.creadoEn` (no se alerta inmediatamente después de crear la cuenta — el usuario nuevo tiene margen razonable para su primer login). | Evitar ruido: alertar el mismo día que se crea una cuenta nueva no aporta nada. |
| RN-USR-003 | Solo se cuentan/alertan cuentas con `activo = true` en el banner resumen — una cuenta ya desactivada no necesita "revisión de acceso" porque ya no tiene acceso. | El banner es para acción (¿sigue siendo necesaria esta cuenta?), no aplica a cuentas ya cerradas. |

## Casos borde considerados
- Usuario nunca conectado, cuenta recién creada (sin alerta hasta pasar 90 días).
- Usuario con muchas sesiones históricas (solo importa la más reciente, no se listan todas).
