# SQL — Modelo de datos — comercial-embudo-ventas

## Cambio de schema
- `Cotizacion.probabilidad Int @default(50)` — nueva columna.
- **Migración:** `20260805020107_cotizacion_probabilidad`.
- Sin backfill necesario: el `@default(50)` de Prisma/SQLite aplica a filas existentes al agregar la columna.

## Por qué no un modelo `Oportunidad` separado
Se evaluó y descartó extender el esquema con un modelo nuevo — `Cotizacion` ya tiene cliente, vendedor, monto, fecha y estado; agregar `probabilidad` ahí evita una tabla paralela que habría que mantener sincronizada 1:1 con la cotización (mismo motivo M6 del glosario de `docs/gobernanza/02-cruce-rf/_motivos-comunes.md`: "ya cubierto por un módulo más simple").
