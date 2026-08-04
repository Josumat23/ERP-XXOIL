# TEST — Verificación — configuracion-usuarios

## Escenario 1 — Estado real (5 usuarios de seed)
- **Pasos:** `GET /configuracion/usuarios`.
- **Resultado esperado:** `admin` muestra su última conexión real; los otros 4 (nunca conectados, creados recientemente) muestran "Nunca inició sesión" sin ⚠, sin banner.
- **Resultado obtenido:** exacto a lo esperado.

## Escenario 2 — Cuenta vieja sin login (umbral de 90 días)
- **Datos usados:** `Usuario.creadoEn` del usuario `ventas` cambiado por SQL a `2025-01-01` (más de 90 días atrás).
- **Pasos:** recargar `/configuracion/usuarios`.
- **Resultado esperado:** banner "⚠ 1 cuenta activa sin conexión..." y la fila de `ventas` con "Nunca inició sesión ⚠" en ámbar.
- **Resultado obtenido:** exacto a lo esperado.
- **Limpieza:** `creadoEn` de `ventas` restaurado al mismo valor que `admin` (fecha real de seed) — confirmado que el banner desapareció al recargar.

## `tsc --noEmit`
- Baseline de 6 archivos preexistentes sin cambios.

## Datos de prueba a limpiar
- Solo un `UPDATE` temporal de `Usuario.creadoEn`, revertido tras la prueba. Ningún registro nuevo insertado.
