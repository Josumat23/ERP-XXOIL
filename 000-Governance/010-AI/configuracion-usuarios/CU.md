# CU — Casos de uso — configuracion-usuarios

## CU-USR-001 — Revisión periódica de accesos

- **Actor:** ADMIN
- **Precondición:** ninguna
- **Flujo principal:**
  1. El ADMIN abre `/configuracion/usuarios` (ej. como rutina trimestral).
  2. Si hay cuentas activas sin login reciente, ve el banner ámbar con el conteo arriba de la tabla.
  3. Identifica cada cuenta marcada con ⚠ en la columna "Última conexión".
  4. Decide si desactivarla (botón "Desactivar" ya existente) o dejarla, según si la persona sigue necesitando acceso.
- **Postcondición:** el ADMIN tomó una decisión informada sobre cuentas potencialmente obsoletas, sin tener que cruzar datos a mano.
