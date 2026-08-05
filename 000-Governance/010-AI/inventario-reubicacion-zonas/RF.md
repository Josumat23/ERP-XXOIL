# RF — Requisitos funcionales — inventario-reubicacion-zonas

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-WM-EWM-001 | Debe existir una forma de cambiar la zona de almacenamiento (`ZonaAlmacen`) de una `Presentacion` o `Insumo` sin pasar por el flujo de traslado entre almacenes distintos. | Baja | Construido y verificado |
| RF-WM-EWM-002 | La reubicación debe impedir asignar una zona que pertenezca a un almacén distinto al actual del ítem — eso debe seguir usando el traslado entre almacenes existente. | Media | Construido y verificado |

## Notas
- Origen: `docs/gobernanza/02-cruce-rf/WM-EWM.md`, gap identificado como "bajo esfuerzo si se necesita": "Traslado entre zonas del mismo almacén (hoy `inventario/traslados` solo mueve entre almacenes distintos, no entre zonas de un mismo almacén)".
- Hallazgo real durante el análisis (no documentado antes): `Presentacion`/`Insumo` no tienen cantidad partida por zona — `zonaAlmacenId` es un puntero único a "dónde vive físicamente el ítem", no un saldo. Por eso esto es una reubicación de metadato, no un movimiento de kardex — ver `SQL.md`.
