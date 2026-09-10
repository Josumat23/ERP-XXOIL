# Aislamiento multiempresa de controles de inventario

Este bloque limita ajustes, traslados, reubicaciones, conteos cíclicos, kardex, exactitud y rotación ABC a la empresa activa.

Las Server Actions validan nuevamente los ítems, almacenes y zonas recibidos desde el navegador. Los conteos y referencias de traslado se numeran dentro de cada compañía; el índice de conteos cambia de unicidad global a `(empresaId, codigo)` sin alterar datos existentes.

Las vistas y reportes filtran tanto los maestros como los movimientos y saldos mediante `empresaId` o la relación obligatoria con el almacén propietario.

## Verificación

- Prisma valida el esquema y aplica la migración en la base efímera de pruebas.
- La suite verifica numeración independiente en dos compañías.
- TypeScript, lint, build y revisión estática completan la validación.
