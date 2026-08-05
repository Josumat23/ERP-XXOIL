# SQL — Modelo de datos — inventario-reubicacion-zonas

Sin cambios de schema. Se reutiliza `Presentacion.zonaAlmacenId` / `Insumo.zonaAlmacenId` (ya existentes,
nullable, apuntan a `ZonaAlmacen`).

## Por qué no hay migración ni tabla nueva
`ZonaAlmacen` en este modelo de datos es la ubicación **actual** de un ítem, no una tabla de saldos
por zona (a diferencia de `SaldoAlmacen`, que sí es un saldo por almacén). Por eso "reubicar entre
zonas" es un `UPDATE` de un solo campo, no un movimiento de kardex — no hay cantidad que partir
entre dos ubicaciones porque el modelo nunca tuvo esa granularidad, y agregarla (saldo por zona,
como EWM real) sería sobre-ingeniería para el volumen de zonas de XXOil (3 zonas activas hoy).
