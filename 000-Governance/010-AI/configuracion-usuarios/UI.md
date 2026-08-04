# UI — Pantallas — configuracion-usuarios

## /configuracion/usuarios

- **Tipo:** lista/gestión, ya existente, extendida
- **Qué muestra ahora:** nueva columna "Última conexión" (fecha/hora formateada, o "Nunca inició sesión"); banner ámbar arriba de la tabla con el conteo de cuentas activas a revisar, visible solo si el conteo es > 0.
- **Interacciones:** ninguna nueva — la columna es informativa; el botón "Desactivar" ya existía.
- **Estados visuales:** texto y badge ⚠ en ámbar cuando `alerta === true`; gris normal en caso contrario.
- **Navegación:** sin cambios (ruta ya existente, ya en `src/lib/navegacion.ts`).
